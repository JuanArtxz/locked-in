-- v5: pause/resume + hourly check-in log
ALTER TABLE sessions ADD COLUMN paused_sec INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN pause_intervals TEXT;

CREATE TABLE IF NOT EXISTS hourly_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  text TEXT,
  skipped INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hourly_logs_day ON hourly_logs(day);
