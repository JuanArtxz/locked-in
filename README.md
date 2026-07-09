<div align="center">

# 🔒 Locked In

**Um app de foco/deep work que é seu de verdade: 100% local, 100% open source, zero telemetria.**

*A personal deep-work companion for Windows — fully local, fully open source, zero telemetry.*

[![License: MIT](https://img.shields.io/badge/License-MIT-d4ff3f.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB.svg)](https://tauri.app)
[![Platform](https://img.shields.io/badge/Windows-10%2F11-0078D6.svg)]()

[⬇️ Baixar a última versão / Download latest](https://github.com/brgamesjao-blip/locked-in/releases/latest)

</div>

---

## O que é

Locked In é um app desktop de foco pra quem tem rotina de cabeça pra baixo. Sem pomodoro engessado, sem horário fixo, sem conta, sem nuvem: você aperta **LOCK IN**, trabalha, e o app registra tudo — honestamente — num banco SQLite que fica só na sua máquina.

Tem um mascote de pixel que fica mais feliz quanto mais tempo você foca. Ele julga você quando abre o Discord. É sério.

## ✨ Funcionalidades

| | |
|---|---|
| ⏱️ **Sessões abertas** | Timer count-up, pausa/continua, nota de foco 1–5, breaks com estouro registrado |
| 🪞 **Espelho de foco** | Registra quais apps você realmente usou durante a sessão (win32, local) |
| 🕵️ **AFK honesto** | Saiu do PC? Ele detecta e pergunta se desconta do bloco |
| 🌙 **Virada de meia-noite** | Sessão de 23h às 3h conta 1h ontem + 3h hoje — automático |
| ✅ **Check-in horário** | Popup no canto a cada hora (configurável): "o que você fez?" — com streak |
| 😤 **Anti-procrastinação** | 5min no Discord/Instagram/TikTok → aviso bonito com mascote bravo (lista editável) |
| 📊 **Stats de verdade** | Heatmap 6 meses, semana vs sua média, melhor hora por projeto, perfil de distração |
| 🔁 **Hábitos semanais** | Sem dia fixo, sem horário: meta por semana, marcou quando fez |
| 🤖 **Chat com seus dados** | IA (Claude) responde perguntas sobre SEU histórico via SQL local — traga sua própria chave |
| 🖥️ **Overlay flutuante** | Mini-janela sempre visível com timer, mascote e barra de meta |
| 🏆 **Marcos** | 10h num projeto, streaks de meta, recordes — celebrados na hora |
| 🌎 **PT-BR / EN** | Idioma completo, escolhido no primeiro uso |
| 🔔 **Notificações próprias** | Nada de toast do Windows — tudo popup customizado com o mascote |
| 💾 **Backup diário** | Cópia automática do banco, últimos 14 dias, na sua máquina |
| 🚀 **Aviso de atualização** | Checa este repositório e avisa quando sair versão nova |

## 🔐 Privacidade e segurança

- **Tudo local.** Seus dados moram em `%APPDATA%\dev.lockedin.app\locked-in.db`. Nenhum byte sai da sua máquina.
- **Zero chaves no código.** O Chat com IA é opcional e usa a SUA chave da API Anthropic, colada nos Ajustes e guardada só no seu banco local.
- **Zero telemetria, zero analytics, zero conta.**
- A única conexão de rede que o app faz sozinho é buscar o `latest.json` deste repositório pra avisar de atualização (e a IA, se você ativar).

## 📦 Instalação

1. Baixa o `.exe` na [página de releases](https://github.com/brgamesjao-blip/locked-in/releases/latest)
2. Instala (não precisa de admin)
3. LOCK IN 🔒

> O instalador não é assinado (certificado custa caro rs), então o Windows SmartScreen pode reclamar — "Mais informações" → "Executar assim mesmo". O código é todo aberto aqui, pode auditar.

## 🛠️ Build a partir do código

Pré-requisitos: [Node.js](https://nodejs.org) 20+, [Rust](https://rustup.rs), e as [dependências do Tauri](https://tauri.app/start/prerequisites/) (MSVC Build Tools + WebView2).

```bash
git clone https://github.com/brgamesjao-blip/locked-in.git
cd locked-in
npm install
npm run tauri dev     # desenvolvimento
npm run tauri build   # gera o instalador em src-tauri/target/release/bundle/
```

## 🧱 Stack

**Tauri 2** (Rust) · **React 19** + TypeScript · **Tailwind CSS 4** · **SQLite** (tauri-plugin-sql) · Recharts

As partes críticas de tempo (check-in horário, detector de procrastinação) rodam em threads nativas Rust — imunes ao throttling do WebView2. Detecção de janela ativa e ociosidade via win32 (`GetForegroundWindow`, `GetLastInputInfo`), sem hooks de teclado.

## 🗂️ Como o código se organiza

```
src/                      # frontend React
  components/             # telas: Home, Checkin, Habits, Week, Log, Stats, Chat, Settings
  components/Popup.tsx    # janela de popups do canto (check-in, nudge, avisos, update)
  components/Overlay.tsx  # mini-janela flutuante
  components/Mascot.tsx   # o mascote de pixel (7 humores, anda, comemora)
  hooks/useFocusSession.ts# máquina de estados da sessão (pausa, AFK, split de meia-noite)
  lib/db.ts               # todo o acesso a SQLite
  lib/i18n.ts             # dicionário PT/EN completo
src-tauri/
  src/lib.rs              # comandos Rust, threads vigias, bandeja, backup
  migrations/             # schema do banco, versionado
```

## 🤝 Contribuindo

Issue e PR abertos. O app é pessoal e opinativo — features que adicionem conta, nuvem ou telemetria não entram.

## 📄 Licença

[MIT](LICENSE) — faz o que quiser, só mantém o aviso.

---

<div align="center">

**English TL;DR:** Locked In is a fully-local Windows deep-work tracker built with Tauri 2 + React. Open count-up focus sessions with pause and honest AFK detection, hourly check-in journal with streaks, anti-procrastination nudges, real analytics (6-month heatmap, best hour per project, distraction profile), weekly habits, an optional AI chat over your own SQLite data (bring your own Anthropic key), a pixel mascot that gets happier the longer you focus, and custom in-app notifications. No account, no cloud, no telemetry — your data never leaves your machine. Full PT-BR and English UI.

Feito com 🔒 e um mascote de pixel que acredita em você.

</div>
