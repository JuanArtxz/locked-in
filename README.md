<div align="center">

# 🔒 Locked In

**A deep-work companion with a pixel mascot that believes in you — and friends who judge you when you slack.**

[![License: MIT](https://img.shields.io/badge/License-MIT-d4ff3f.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB.svg)](https://tauri.app)
[![Platform](https://img.shields.io/badge/Windows-10%2F11-0078D6.svg)]()

[⬇️ Download the latest version](https://github.com/JuanArtxz/locked-in/releases/latest)

</div>

---

## What is this

Locked In is a Windows desktop focus tracker built for people whose routine is upside down. No rigid pomodoro, no fixed schedule: you hit **LOCK IN**, work, and the app records everything — honestly — into a local SQLite database.

Works fully offline as a guest. Create an account and it becomes social: friends see you focusing live, you chat, you jam together on shared focus sessions, and there's a weekly ranking to settle who actually worked.

There's a pixel mascot that gets happier the longer you stay focused. It judges you when you open Discord. This is serious.

## ✨ Features

### Focus
| | |
|---|---|
| ⏱️ **Open sessions** | Count-up timer, pause/resume, 1–5 focus rating, breaks with overrun tracking |
| 🕰️ **Clock styles** | Five timer looks (Classic, Thin, Mono, Serif, Stacked) + a minimal mode that hides everything but the timer — perfect for a second monitor |
| 🪞 **Focus mirror** | Records which apps you actually used during a session (win32, fully local) |
| 🕵️ **Honest AFK** | Left the PC? It notices and asks whether to deduct the time |
| 🌙 **Midnight-proof** | An 11pm–3am session counts 1h yesterday + 3h today — automatically |
| ✅ **Hourly check-in** | Corner popup every hour (configurable): "what did you get done?" — with streaks |
| 😤 **Anti-procrastination** | 5 continuous minutes on Discord/Instagram/TikTok → a nudge with an angry mascot (watchlist is editable) |
| 🤖 **Auto-track** | Opening your work apps can start a session by itself |
| 📊 **Real analytics** | Year heatmap, week vs. your own average, productivity score, per-app breakdown, full session history |
| 🔁 **Weekly habits** | No fixed days, no schedule: a weekly target you tick whenever you did the thing |
| 🎯 **Project goals** | Per-project hour targets with progress and the daily pace needed to hit a deadline |
| 🖥️ **Floating overlay** | Tiny always-on-top window with the timer, the mascot and your daily goal bar |
| 🏆 **Milestones** | 10h on a project, goal streaks, personal records — celebrated on the spot |

### Social (optional — needs a free account)
| | |
|---|---|
| 👥 **Friends & presence** | Add friends by username, see who's focusing live and on what |
| 🎧 **JAM sessions** | Focus together: shared timer, live room with everyone inside, cheer people on |
| 💬 **Chat** | DMs and group chats: text, images, voice notes with a waveform player, mascot stickers, reactions, replies, edit, pin — the works |
| 🏅 **Weekly ranking** | Podium, your position, squad stats — since Monday or all-time |
| 👊 **Pokes & shame** | Nudge an idle friend; the jam tells on whoever alt-tabs to Discord |
| 🧑‍🤝‍🧑 **Groups** | Up to 5 people, group jams, collective weekly goal, invite links |

### Platform
| | |
|---|---|
| ☁️ **Cloud backup & sync** | Sign in and your history follows you to any PC; sign out and the device resets to a clean guest |
| 🔄 **Auto-updates** | One click: downloads, installs with a progress screen and restarts itself (cryptographically signed) |
| 🌎 **English / PT-BR** | Full UI in both languages (English by default, switch in Settings) |
| 🔔 **Custom notifications** | No Windows toasts — every notification is a custom in-app popup with the mascot |
| 💾 **Daily backups** | Automatic local copy of your database, last 14 days |

## 🔐 Privacy & security

- **Guest mode is fully local.** Without an account, your data lives in `%APPDATA%\dev.lockedin.app\locked-in.db` and focus data doesn't leave your machine.
- **Accounts are optional.** Auth, sync and social run on Supabase with Row Level Security — every row is readable/writable only by its owner (or, for messages, its two participants), enforced server-side. The key embedded in this repo is Supabase's *anon key*, which is public by design and grants nothing without RLS passing.
- **Chat** uses the same model as Discord/Slack: messages are protected by server-side access control. Media files are additionally encrypted at rest with a random per-file key.
- **No AI, no analytics.** Insights are generated locally by simple rules over your own data. Crash reports are strictly opt-in and off by default — they never include message content.
- Network requests the app makes: update checks against this repository, and cloud sync + social (only if you sign in). Nothing else.
- Updates are signed: the app only installs updates whose signature matches the public key baked into the binary.

## 📦 Install

1. Grab the `.exe` from the [releases page](https://github.com/JuanArtxz/locked-in/releases/latest)
2. Install it (no admin needed)
3. LOCK IN 🔒

> The installer isn't code-signed (certificates are expensive), so Windows SmartScreen may complain — "More info" → "Run anyway". The entire source is right here, audit away.

## 🛠️ Build from source

Prerequisites: [Node.js](https://nodejs.org) 20+, [Rust](https://rustup.rs), and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) (MSVC Build Tools + WebView2).

```bash
git clone https://github.com/JuanArtxz/locked-in.git
cd locked-in
npm install
npm run tauri dev     # development
npm run tauri build   # installer lands in src-tauri/target/release/bundle/
```

## 🧱 Stack

**Tauri 2** (Rust) · **React 19** + TypeScript · **Tailwind CSS 4** · **SQLite** (tauri-plugin-sql) · **Supabase** (auth, Postgres + RLS, Storage, Realtime) · Recharts

Time-critical logic (hourly check-in, procrastination watcher) runs on native Rust threads — immune to WebView2 timer throttling. Foreground-window and idle detection use win32 APIs (`GetForegroundWindow`, `GetLastInputInfo`) — no keyboard hooks, ever.

## 🗂️ Code map

```
src/                      # React frontend
  components/             # screens: Home, Checkin, Habits, Week, Stats, Log, Goals,
                          #          Friends, Chat, Groups, Ranking, Profile, Settings
  components/Popup.tsx    # corner popup window (check-in, nudge, notices, updates)
  components/Overlay.tsx  # floating mini window
  components/Mascot.tsx   # the pixel mascot (7 moods, walks, celebrates)
  hooks/useFocusSession.ts# session state machine (pause, AFK, midnight split)
  lib/db.ts               # all SQLite access
  lib/cloud.ts            # accounts + snapshot sync (Supabase)
  lib/chat.ts, groups.ts  # messaging
  lib/i18n.ts             # full EN/PT dictionary
src-tauri/
  src/lib.rs              # Rust commands, watcher threads, tray, backup, update popup
  migrations/             # versioned database schema
supabase/social.sql       # the entire server: tables, RLS policies, triggers
```

## 🤝 Contributing

Issues and PRs welcome. This is a personal, opinionated app — features that add tracking/analytics or third-party AI won't be merged.

## 📄 License

[MIT](LICENSE) — do whatever you want, just keep the notice.

---

<div align="center">

Made with 🔒 and a pixel mascot that believes in you.

</div>
