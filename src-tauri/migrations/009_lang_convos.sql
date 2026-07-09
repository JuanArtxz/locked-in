INSERT OR IGNORE INTO settings (key, value) VALUES ('language', '');

CREATE TABLE IF NOT EXISTS chat_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  display TEXT NOT NULL,
  history TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO chat_conversations (title, display, history, created_at, updated_at)
SELECT 'Conversa', display, history, updated_at, updated_at
FROM chat_state WHERE id = 1 AND display != '[]';
