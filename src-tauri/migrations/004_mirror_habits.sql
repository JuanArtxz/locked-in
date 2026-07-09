ALTER TABLE sessions ADD COLUMN app_usage TEXT;
ALTER TABLE sessions ADD COLUMN afk_sec INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN afk_intervals TEXT;

CREATE TABLE IF NOT EXISTS habits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '✅',
  weekly_target INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id INTEGER NOT NULL REFERENCES habits(id),
  date TEXT NOT NULL,
  UNIQUE(habit_id, date)
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('mirror_enabled', 'true'),
  ('afk_enabled', 'true'),
  ('afk_threshold_min', '5'),
  ('burnout_enabled', 'true'),
  ('burnout_limit_hours', '10');
