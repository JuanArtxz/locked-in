import { useEffect, useRef, useState } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import * as db from '../lib/db';
import { getLang, t } from '../lib/i18n';
import { dateKey, todayKey } from '../lib/time';
import type { ChatConversation } from '../types';
import { Mascot } from './Mascot';
import type { MascotMood } from './Mascot';

interface ChatProps {
  apiKey: string;
  onError: (message: string) => void;
  onOpenSettings: () => void;
}

interface DisplayMessage {
  role: 'user' | 'assistant';
  text: string;
  queries?: string[];
  thoughts?: string;
}

const MODEL = 'claude-sonnet-5';
const MAX_TOOL_ROUNDS = 8;

const QUERY_TOOL: Anthropic.Tool = {
  name: 'query_database',
  description:
    'Executa uma consulta SELECT no banco SQLite local do app de foco. Use quantas vezes precisar pra responder com precisão. Apenas SELECT.',
  input_schema: {
    type: 'object',
    properties: {
      sql: {
        type: 'string',
        description: 'A consulta SELECT (uma por chamada, sem ponto-e-vírgula extra)',
      },
    },
    required: ['sql'],
  },
};

const SUGGESTIONS_PT: { label: string; prompt: string }[] = [
  { label: 'como foi hoje?', prompt: 'Resumo de hoje: horas focadas, blocos, principais apps, rating médio. Curto e direto.' },
  { label: 'e a semana?', prompt: 'Resumo da semana atual vs semana passada: total de horas, melhor dia, projeto principal. Destaca se melhorei ou piorei.' },
  { label: 'meus recordes', prompt: 'Meus recordes de todos os tempos: maior bloco único, melhor dia, melhor semana, projeto com mais horas acumuladas.' },
  { label: 'onde eu perco foco?', prompt: 'Analisa meu perfil de distração: quais apps aparecem nos blocos de rating baixo (1-2) e quanto tempo roubam. Cruza app_usage com focus_rating.' },
  { label: 'quando eu rendo mais?', prompt: 'Em qual faixa de horário meus blocos têm melhor rating e mais duração? Analisa started_at (localtime) vs focus_rating e duration_sec.' },
  { label: 'me dá um conselho', prompt: 'Com base nos meus padrões reais (horários, ratings, breaks estourados, AFK), me dá UM conselho acionável pra focar melhor. Consulta os dados antes.' },
];

const SUGGESTIONS_EN: { label: string; prompt: string }[] = [
  { label: 'how was today?', prompt: "Summarize today: focused hours, blocks, main apps, average rating. Short and direct." },
  { label: 'and the week?', prompt: 'This week vs last week: total hours, best day, main project. Highlight if I improved or not.' },
  { label: 'my records', prompt: 'My all-time records: longest single block, best day, best week, project with most accumulated hours.' },
  { label: 'where do I lose focus?', prompt: 'Analyze my distraction profile: which apps appear in low-rated blocks (1-2) and how much time they steal. Cross app_usage with focus_rating.' },
  { label: 'when am I sharpest?', prompt: 'In which time window do my blocks have the best rating and longest duration? Analyze started_at (localtime) vs focus_rating and duration_sec.' },
  { label: 'give me one tip', prompt: 'Based on my real patterns (hours, ratings, overrun breaks, AFK), give me ONE actionable tip to focus better. Query the data first.' },
];

const GREETINGS_PT = ['e aí', 'opa', 'fala tu', 'salve'];
const GREETINGS_EN = ['hey', 'yo', "what's up", 'hi there'];
const THINK_PT = ['deixa eu ver aqui', 'hmm, pensando', 'peraí, calculando'];
const THINK_EN = ['let me see', 'hmm, thinking', 'hold on, crunching'];
const DIG_PT = ['fuçando no seu banco', 'puxando seus dados', 'olhando seus números'];
const DIG_EN = ['digging through your db', 'pulling your data', 'checking your numbers'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Trims API history without cutting a tool round in half — the first message
 * must be a plain user turn, or the API rejects orphaned tool_results.
 */
function trimHistory(msgs: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  let out = msgs.slice(-20);
  while (out.length > 0 && !(out[0].role === 'user' && typeof out[0].content === 'string')) {
    out = out.slice(1);
  }
  return out;
}

const SCHEMA_BLOCK = `Schema:
- sessions(id, task TEXT, project TEXT nullable, started_at TEXT ISO-8601 UTC, ended_at TEXT nullable, duration_sec INTEGER, focus_rating INTEGER 1-5 nullable, notes TEXT nullable, app_usage TEXT JSON {"app name": seconds} nullable, afk_sec INTEGER, paused_sec INTEGER)
- breaks(id, session_id, started_at, planned_sec, ended_at nullable, overrun_sec nullable)
- habits(id, name, emoji, weekly_target, created_at, archived 0/1)
- habit_logs(id, habit_id, date TEXT yyyy-mm-dd)
- milestones(key, achieved_at)
- hourly_logs(id, day TEXT yyyy-mm-dd LOCAL, period_start TEXT "HH:MM", period_end TEXT "HH:MM", text TEXT nullable, skipped 0/1, created_at) — hourly check-in journal: what the user says they did each hour
Note: sessions crossing local midnight are stored split into one row per day, so daily sums are already correct. duration_sec excludes pauses and deducted AFK.`;

function systemPrompt(): string {
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const clock = `${now.toISOString()} (local: ${now.toLocaleString()})`;

  if (getLang() === 'en') {
    return `You are the Locked In mascot — the AI companion inside a personal deep-work/focus app. You're sharp, direct, slightly playful, never corporate. You answer questions about the user's data by querying their local SQLite via the query_database tool.

${SCHEMA_BLOCK}
Each sessions row is one focus block. Active sessions have ended_at NULL (ignore them in sums).

Data rules:
- Timestamps are UTC ISO. User's local timezone: ${tz}. Now: ${clock}.
- Always use date(started_at, 'localtime') to group by local day. strftime('%H', started_at, 'localtime') for local hour.
- app_usage is JSON — use json_each(app_usage) to explode it when analyzing apps.
- Run as many queries as needed; prefer 2-3 precise queries over one giant one.

Response style:
- ALWAYS answer in casual, friendly English — like a friend who's good with data. Zero corporate speak, zero "I'd be happy to help".
- Format durations like "4h32", never raw seconds.
- CONCISE: answer in 1-4 lines + at most one short list when it helps.
- Round numbers: "~15h" instead of "15h03m12s" when precision doesn't matter.
- Never judge or guilt-trip. Honesty without weight.
- If asked for advice, base it on data you actually queried, not generic productivity tips.
- If the question isn't about data, answer normally, short, without querying.`;
  }

  return `Você é o mascote do Locked In — um app pessoal de foco/deep work. Você é a IA companheira do usuário: esperta, direta, levemente brincalhona, nunca corporativa. Você responde perguntas sobre os dados dele consultando o SQLite local via a tool query_database.

${SCHEMA_BLOCK}
Cada linha de sessions é um bloco de foco. Sessões ativas têm ended_at NULL (ignore em somas).

Regras de dados:
- Timestamps em UTC ISO. Fuso local do usuário: ${tz}. Agora: ${clock}.
- Sempre use date(started_at, 'localtime') pra agrupar por dia local. strftime('%H', started_at, 'localtime') pra hora local.
- app_usage é JSON — use json_each(app_usage) pra explodir quando precisar analisar apps.
- Rode quantas queries precisar; prefira 2-3 queries certeiras a uma gigante.

Estilo de resposta:
- SEMPRE responda em português brasileiro coloquial, tom de amigo. Zero corporativês, zero "com certeza!", zero "fico feliz em ajudar".
- Formate durações como "4h32", não segundos.
- CONCISO: responde a pergunta em 1-4 linhas + no máximo uma listinha curta quando fizer sentido.
- Números redondos: "~15h" em vez de "15h03min12s" quando precisão não importa.
- Nunca julgue ou culpe. Honestidade sem peso.
- Se pedirem conselho, baseie em dados que você consultou, não em genérico de produtividade.
- Se a pergunta não é sobre dados, responde normal, curto, sem consultar o banco.`;
}

function relDate(iso: string): string {
  const key = dateKey(iso);
  if (key === todayKey()) return t('chat.today');
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yk = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  if (key === yk) return t('chat.yesterday');
  return new Date(iso).toLocaleDateString(getLang() === 'en' ? 'en-US' : 'pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

export function Chat({ apiKey, onError, onOpenSettings }: ChatProps) {
  const [convos, setConvos] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [history, setHistory] = useState<Anthropic.MessageParam[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [liveQuery, setLiveQuery] = useState<string | null>(null);
  const [mood, setMood] = useState<MascotMood>('relax');
  const [expandedThought, setExpandedThought] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [greeting] = useState(() => pick(getLang() === 'en' ? GREETINGS_EN : GREETINGS_PT));
  const [thinkPhrase, setThinkPhrase] = useState('');
  const moodTimer = useRef<number | null>(null);
  const deleteTimer = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<number | null>(null);
  activeIdRef.current = activeId;

  const lang = getLang();
  const suggestions = lang === 'en' ? SUGGESTIONS_EN : SUGGESTIONS_PT;

  useEffect(() => {
    db.listConversations().then(setConvos).catch(() => {});
    return () => {
      if (moodTimer.current) window.clearTimeout(moodTimer.current);
      if (deleteTimer.current) window.clearTimeout(deleteTimer.current);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, liveQuery]);

  function setMoodFor(m: MascotMood, ms: number, then: MascotMood = 'relax') {
    if (moodTimer.current) window.clearTimeout(moodTimer.current);
    setMood(m);
    moodTimer.current = window.setTimeout(() => setMood(then), ms);
  }

  async function openConversation(id: number) {
    if (busy || id === activeId) return;
    const data = await db.getConversation(id).catch(() => null);
    if (!data) return;
    try {
      setMessages(JSON.parse(data.display) as DisplayMessage[]);
      setHistory(JSON.parse(data.history) as Anthropic.MessageParam[]);
      setActiveId(id);
      setExpandedThought(null);
    } catch {
      onError('conversa corrompida');
    }
  }

  function newConversation() {
    if (busy) return;
    setActiveId(null);
    setMessages([]);
    setHistory([]);
    setExpandedThought(null);
  }

  function requestDelete(id: number) {
    if (confirmDelete === id) {
      if (deleteTimer.current) window.clearTimeout(deleteTimer.current);
      setConfirmDelete(null);
      db.deleteConversation(id)
        .then(() => {
          setConvos((prev) => prev.filter((c) => c.id !== id));
          if (activeId === id) newConversation();
        })
        .catch((err) => onError(String(err)));
      return;
    }
    setConfirmDelete(id);
    if (deleteTimer.current) window.clearTimeout(deleteTimer.current);
    deleteTimer.current = window.setTimeout(() => setConfirmDelete(null), 3000);
  }

  async function persist(finalMessages: DisplayMessage[], finalHistory: Anthropic.MessageParam[]) {
    const display = JSON.stringify(finalMessages);
    const hist = JSON.stringify(finalHistory);
    try {
      if (activeIdRef.current === null) {
        const firstUser = finalMessages.find((m) => m.role === 'user');
        const title = (firstUser?.text ?? 'Conversa').slice(0, 42);
        const id = await db.createConversation(title, display, hist);
        setActiveId(id);
      } else {
        await db.updateConversation(activeIdRef.current, display, hist);
      }
      setConvos(await db.listConversations());
    } catch {
      // persistence is best-effort
    }
  }

  if (!apiKey.trim()) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <Mascot mood="sad" size={110} />
        <div className="max-w-sm">
          <h2 className="text-base font-semibold text-text">{t('chat.nokey.title')}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-text-dim">{t('chat.nokey.sub')}</p>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg hover:brightness-110"
        >
          {t('chat.nokey.btn')}
        </button>
      </div>
    );
  }

  async function send(rawText?: string) {
    const text = (rawText ?? input).trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    setMood('think');
    setThinkPhrase(pick(lang === 'en' ? THINK_EN : THINK_PT));
    const baseMessages: DisplayMessage[] = [...messages, { role: 'user', text }];
    setMessages(baseMessages);

    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    let msgs: Anthropic.MessageParam[] = [...history, { role: 'user', content: text }];
    const queriesRun: string[] = [];
    const thoughtParts: string[] = [];

    try {
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 4096,
          thinking: { type: 'adaptive', display: 'summarized' },
          system: systemPrompt(),
          tools: [QUERY_TOOL],
          messages: msgs,
        });

        for (const block of response.content) {
          if (block.type === 'thinking' && block.thinking.trim()) {
            thoughtParts.push(block.thinking.trim());
          }
        }

        msgs = [...msgs, { role: 'assistant', content: response.content }];

        if (response.stop_reason === 'tool_use') {
          setThinkPhrase(pick(lang === 'en' ? DIG_EN : DIG_PT));
          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const block of response.content) {
            if (block.type !== 'tool_use') continue;
            const sql = (block.input as { sql?: string }).sql ?? '';
            queriesRun.push(sql);
            setLiveQuery(sql);
            try {
              const rows = await db.rawSelect(sql);
              results.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(rows.slice(0, 200)),
              });
            } catch (err) {
              results.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: String(err),
                is_error: true,
              });
            }
          }
          msgs = [...msgs, { role: 'user', content: results }];
          continue;
        }

        const answer = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        const finalMessages: DisplayMessage[] = [
          ...baseMessages,
          {
            role: 'assistant',
            text: answer || '…',
            queries: queriesRun.length > 0 ? queriesRun : undefined,
            thoughts: thoughtParts.length > 0 ? thoughtParts.join('\n\n') : undefined,
          },
        ];
        const finalHistory = trimHistory(msgs);
        setMessages(finalMessages);
        setHistory(finalHistory);
        setMoodFor('happy', 3000);
        await persist(finalMessages, finalHistory);
        break;
      }
    } catch (err) {
      const message =
        err instanceof Anthropic.AuthenticationError
          ? t('chat.error.auth')
          : err instanceof Anthropic.RateLimitError
            ? t('chat.error.rate')
            : String(err);
      onError(message);
      setMessages((prev) => [...prev, { role: 'assistant', text: t('chat.error', message) }]);
      setMoodFor('sad', 4000);
    } finally {
      setBusy(false);
      setLiveQuery(null);
    }
  }

  return (
    <div className="flex h-full">
      {/* sidebar */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-border sm:flex">
        <div className="p-2.5">
          <button
            type="button"
            onClick={newConversation}
            disabled={busy}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text transition-colors hover:border-accent/40 hover:bg-surface-hover disabled:opacity-40"
          >
            <span className="text-accent">+</span> {t('chat.new')}
          </button>
        </div>
        <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
          {convos.length > 0 && (
            <div className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-[0.12em] text-text-faint">
              {t('chat.conversations')}
            </div>
          )}
          <div className="space-y-0.5">
            {convos.map((c) => (
              <div
                key={c.id}
                className={`group/convo animate-fade-in relative rounded-lg transition-colors ${
                  activeId === c.id ? 'bg-surface-hover' : 'hover:bg-surface'
                }`}
              >
                <button
                  type="button"
                  onClick={() => openConversation(c.id)}
                  disabled={busy}
                  className="block w-full px-2.5 py-2 text-left disabled:opacity-50"
                >
                  <div
                    className={`truncate pr-5 text-xs ${
                      activeId === c.id ? 'text-text' : 'text-text-dim'
                    }`}
                  >
                    {c.title}
                  </div>
                  <div className="mt-0.5 text-[9px] text-text-faint">{relDate(c.updated_at)}</div>
                </button>
                <button
                  type="button"
                  onClick={() => requestDelete(c.id)}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-1 text-[10px] transition-opacity ${
                    confirmDelete === c.id
                      ? 'bg-danger/15 text-danger opacity-100'
                      : 'text-text-faint opacity-0 hover:text-danger group-hover/convo:opacity-100'
                  }`}
                >
                  {confirmDelete === c.id ? t('chat.delete.confirm') : '✕'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center pt-14">
                <div className="flex h-[110px] items-end">
                  <Mascot mood={mood} size={100} walk={mood === 'relax'} />
                </div>
                <div className="mt-5 text-center">
                  <div className="text-xl font-semibold tracking-tight text-text">
                    {greeting} 👋
                  </div>
                  <div className="mt-1.5 text-sm text-text-dim">{t('chat.empty.sub')}</div>
                </div>
                <div className="mt-7 max-w-md text-center text-[13px] leading-loose text-text-faint">
                  {suggestions.map((s, i) => (
                    <span key={s.label}>
                      <button
                        type="button"
                        onClick={() => send(s.prompt)}
                        className="text-text-dim underline decoration-border underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
                      >
                        {s.label}
                      </button>
                      {i < suggestions.length - 1 && <span className="mx-2 text-border">·</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="animate-fade-up flex justify-end">
                  <div className="max-w-[80%] rounded-lg bg-surface px-3.5 py-2 text-sm leading-relaxed text-text-dim select-text">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="animate-fade-up flex gap-3">
                  <div className="shrink-0 pt-0.5">
                    <Mascot
                      mood={i === messages.length - 1 && !busy ? mood : 'relax'}
                      size={30}
                      effects={false}
                    />
                  </div>
                  <div className="min-w-0 flex-1 pt-1">
                    <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-text select-text">
                      {m.text}
                    </div>
                    {(m.thoughts || m.queries) && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setExpandedThought(expandedThought === i ? null : i)}
                          className="text-[11px] text-text-faint transition-colors hover:text-text-dim"
                        >
                          {expandedThought === i ? '▾' : '▸'} {t('chat.reasoning')}
                          {m.queries && ` · ${m.queries.length}q`}
                        </button>
                        {expandedThought === i && (
                          <div className="animate-fade-in mt-2 space-y-2 border-l-2 border-border pl-3">
                            {m.thoughts && (
                              <div className="whitespace-pre-wrap text-[12px] leading-relaxed text-text-dim select-text">
                                {m.thoughts}
                              </div>
                            )}
                            {m.queries?.map((q, qi) => (
                              <code
                                key={qi}
                                className="block overflow-x-auto font-mono text-[10px] text-text-faint select-text"
                              >
                                {q}
                              </code>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}

            {busy && (
              <div className="animate-fade-in flex gap-3">
                <div className="shrink-0 pt-0.5">
                  <Mascot mood="think" size={30} />
                </div>
                <div className="min-w-0 pt-1.5">
                  <div className="shimmer-text text-sm font-medium">
                    {liveQuery ? pick(lang === 'en' ? DIG_EN : DIG_PT) : thinkPhrase}…
                  </div>
                  {liveQuery && (
                    <code className="mt-1 block max-w-md truncate font-mono text-[10px] text-text-faint">
                      {liveQuery}
                    </code>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 px-4 pb-4 pt-1 sm:px-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="mx-auto flex max-w-2xl items-center gap-2 rounded-xl border border-border bg-surface/80 p-1.5 backdrop-blur transition-colors focus-within:border-border-strong"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={busy ? t('chat.placeholder.busy') : t('chat.placeholder')}
              disabled={busy}
              className="h-9 min-w-0 flex-1 bg-transparent px-3 text-sm text-text placeholder:text-text-faint disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-base font-bold text-bg transition-all hover:brightness-110 disabled:opacity-25"
            >
              ↑
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
