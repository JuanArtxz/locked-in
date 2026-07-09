CREATE TABLE IF NOT EXISTS chat_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  display TEXT NOT NULL,
  history TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
