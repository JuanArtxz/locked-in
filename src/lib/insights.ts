// Artificial "insights" — no AI, no API, no cost. Pure rules over the local
// data that surface an encouraging observation + a concrete suggestion.

import * as db from './db';
import { parseAppUsage } from './apps';
import { localDayKey } from './time';
import type { Session } from '../types';

export interface Insight {
  /** headline, e.g. "focou 6h32 essa semana" */
  headlinePt: string;
  headlineEn: string;
  /** suggestion, e.g. "seu melhor horário é de manhã — empilha o foco ali" */
  tipPt: string;
  tipEn: string;
  mood: 'happy' | 'hyped' | 'focus' | 'think' | 'relax';
}

const DAY_MS = 86_400_000;

function fmt(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function dayKeyNDaysAgo(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return localDayKey(d);
}

/**
 * Picks the single most relevant insight for the home screen. Deterministic:
 * evaluates candidates in priority order and returns the first that qualifies.
 */
export async function computeInsight(dailyGoalHours: number): Promise<Insight | null> {
  const since = new Date(Date.now() - 60 * DAY_MS).toISOString();
  const sessions = await db.listSessions({ fromIso: since, limit: 2000 });
  if (sessions.length === 0) return null;

  // ---- aggregates ----
  const byDay = new Map<string, number>();
  const byHour = new Array<number>(24).fill(0);
  const byWeekday = new Array<number>(7).fill(0); // 0=sun
  const appSec = new Map<string, number>();
  let ratedSum = 0;
  let ratedCount = 0;

  for (const s of sessions) {
    const dur = s.duration_sec ?? 0;
    const day = localDayKey(new Date(s.started_at));
    byDay.set(day, (byDay.get(day) ?? 0) + dur);
    const start = new Date(s.started_at);
    byHour[start.getHours()] += dur;
    byWeekday[start.getDay()] += dur;
    if (s.focus_rating != null) {
      ratedSum += s.focus_rating;
      ratedCount++;
    }
    for (const a of parseAppUsage(s.app_usage)) {
      appSec.set(a.name, (appSec.get(a.name) ?? 0) + a.sec);
    }
  }

  const secIn = (fromDay: number, toDay: number) => {
    let sum = 0;
    for (let i = fromDay; i < toDay; i++) sum += byDay.get(dayKeyNDaysAgo(i)) ?? 0;
    return sum;
  };
  const thisWeek = secIn(0, 7);
  const lastWeek = secIn(7, 14);
  const todaySec = byDay.get(dayKeyNDaysAgo(0)) ?? 0;

  // ---- candidate insights, priority order ----

  // 1. today already beat the daily goal
  if (todaySec >= dailyGoalHours * 3600) {
    return {
      headlinePt: `já bateu a meta hoje — ${fmt(todaySec)} focadas 🔥`,
      headlineEn: `goal already hit today — ${fmt(todaySec)} focused 🔥`,
      tipPt: 'tá voando. Cada bloco extra daqui é lucro puro.',
      tipEn: "you're flying. Every extra block from here is pure profit.",
      mood: 'hyped',
    };
  }

  // 2. this week clearly up vs last week
  if (lastWeek > 0 && thisWeek > lastWeek * 1.15) {
    const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
    return {
      headlinePt: `+${pct}% de foco vs a semana passada`,
      headlineEn: `+${pct}% focus vs last week`,
      tipPt: `${fmt(thisWeek)} essa semana. Segura o ritmo que a curva é tua.`,
      tipEn: `${fmt(thisWeek)} this week. Hold the pace — the curve is yours.`,
      mood: 'happy',
    };
  }

  // 3. this week clearly down vs last week
  if (lastWeek > 3600 && thisWeek < lastWeek * 0.7) {
    return {
      headlinePt: `essa semana rendeu menos que a passada`,
      headlineEn: `this week is behind last week`,
      tipPt: `foram ${fmt(thisWeek)} vs ${fmt(lastWeek)}. Um bloco curto agora já vira a chave.`,
      tipEn: `${fmt(thisWeek)} vs ${fmt(lastWeek)}. One short block right now flips it.`,
      mood: 'focus',
    };
  }

  // 4. best hour of day (needs enough data)
  const totalHourSec = byHour.reduce((a, b) => a + b, 0);
  if (totalHourSec > 5 * 3600) {
    let bestStart = 0;
    let bestSum = -1;
    for (let h = 0; h < 22; h++) {
      const sum = byHour[h] + byHour[h + 1] + byHour[h + 2];
      if (sum > bestSum) {
        bestSum = sum;
        bestStart = h;
      }
    }
    if (bestSum / totalHourSec > 0.3) {
      const band =
        bestStart < 6
          ? { pt: 'de madrugada', en: 'late at night' }
          : bestStart < 12
            ? { pt: 'de manhã', en: 'in the morning' }
            : bestStart < 18
              ? { pt: 'à tarde', en: 'in the afternoon' }
              : { pt: 'à noite', en: 'at night' };
      return {
        headlinePt: `você rende mais ${band.pt}`,
        headlineEn: `you focus best ${band.en}`,
        tipPt: `${Math.round((bestSum / totalHourSec) * 100)}% do teu foco cai entre ${bestStart}h e ${bestStart + 3}h. Guarda o trabalho pesado pra essa janela.`,
        tipEn: `${Math.round((bestSum / totalHourSec) * 100)}% of your focus lands between ${bestStart}:00 and ${bestStart + 3}:00. Save the hard work for that window.`,
        mood: 'think',
      };
    }
  }

  // 5. an app dominates the mirror
  if (appSec.size > 0) {
    const total = [...appSec.values()].reduce((a, b) => a + b, 0);
    const [topApp, topSec] = [...appSec.entries()].sort((a, b) => b[1] - a[1])[0];
    if (total > 3600 && topSec / total > 0.5 && topApp !== 'Locked In') {
      return {
        headlinePt: `${topApp} é onde tua semana vive`,
        headlineEn: `${topApp} is where your week lives`,
        tipPt: `${Math.round((topSec / total) * 100)}% do teu tempo de foco. Se é trampo, ótimo — se não, vale cortar.`,
        tipEn: `${Math.round((topSec / total) * 100)}% of your focus time. If it's work, great — if not, worth trimming.`,
        mood: 'focus',
      };
    }
  }

  // 6. solid average focus rating
  if (ratedCount >= 4) {
    const avg = ratedSum / ratedCount;
    if (avg >= 4) {
      return {
        headlinePt: `teu foco médio tá em ★${avg.toFixed(1)}`,
        headlineEn: `your average focus is ★${avg.toFixed(1)}`,
        tipPt: 'qualidade alta e consistente. Continua desse jeito.',
        tipEn: 'high and steady quality. Keep it exactly like this.',
        mood: 'happy',
      };
    }
  }

  // 7. fallback — gentle nudge based on today
  return {
    headlinePt: todaySec > 0 ? `${fmt(todaySec)} focadas hoje` : 'nenhum bloco hoje ainda',
    headlineEn: todaySec > 0 ? `${fmt(todaySec)} focused today` : 'no blocks today yet',
    tipPt:
      todaySec > 0
        ? `faltam ${fmt(Math.max(0, dailyGoalHours * 3600 - todaySec))} pra meta. Bora mais um.`
        : 'um LOCK IN de 20min já começa a virar o dia.',
    tipEn:
      todaySec > 0
        ? `${fmt(Math.max(0, dailyGoalHours * 3600 - todaySec))} left to goal. One more.`
        : 'a 20-min LOCK IN already turns the day around.',
    mood: 'relax',
  };
}

export type { Session };
