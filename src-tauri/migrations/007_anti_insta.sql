CREATE TABLE IF NOT EXISTS insta_usage (
  date TEXT PRIMARY KEY,
  used_sec INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('insta_enabled', 'true'),
  ('insta_limit_min', '30'),
  ('insta_work_min', '60'),
  ('insta_bonus_min', '30');
