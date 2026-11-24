CREATE TABLE comments_anonymous (
  id INTEGER PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES user(id) ON DELETE SET NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL
);
INSERT INTO comments_anonymous SELECT id, event_id, user_id, body, created_at FROM comments;
DROP TABLE comments;
ALTER TABLE comments_anonymous RENAME TO comments;
CREATE INDEX comments_event ON comments(event_id, id);
CREATE INDEX comments_author_time ON comments(user_id, created_at);
