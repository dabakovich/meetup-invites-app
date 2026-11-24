CREATE TABLE idempotency_keys (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  result TEXT NOT NULL,
  PRIMARY KEY (user_id, operation, key)
);
