CREATE TABLE comment_posts (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE INDEX comment_posts_user_time ON comment_posts(user_id, created_at);
CREATE INDEX comment_posts_time ON comment_posts(created_at);
INSERT INTO comment_posts(user_id, created_at)
  SELECT user_id, created_at FROM comments WHERE user_id IS NOT NULL AND created_at > (unixepoch() * 1000 - 60000);
