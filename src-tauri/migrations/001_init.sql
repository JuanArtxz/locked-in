CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task TEXT NOT NULL,
  project TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_sec INTEGER,
  focus_rating INTEGER,
  mode TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  last_heartbeat_at TEXT
);

CREATE TABLE IF NOT EXISTS breaks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES sessions(id),
  started_at TEXT NOT NULL,
  planned_sec INTEGER NOT NULL,
  ended_at TEXT,
  overrun_sec INTEGER
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('daily_goal_hours', '4'),
  ('pomodoro_work_min', '25'),
  ('pomodoro_break_min', '5'),
  ('overlay_enabled', 'false'),
  ('autostart_enabled', 'false'),
  ('sound_enabled', 'true'),
  ('theme', 'dark');

CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions (started_at);
CREATE INDEX IF NOT EXISTS idx_breaks_session_id ON breaks (session_id);
