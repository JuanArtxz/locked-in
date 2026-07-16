-- v7: per-project goals
CREATE TABLE IF NOT EXISTS project_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  target_hours REAL NOT NULL,
  deadline TEXT,
  created_at TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);
