CREATE TABLE user (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  emailVerified INTEGER NOT NULL DEFAULT 0, image TEXT, createdAt DATE NOT NULL, updatedAt DATE NOT NULL
);
CREATE TABLE session (
  id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  expiresAt DATE NOT NULL, createdAt DATE NOT NULL, updatedAt DATE NOT NULL, ipAddress TEXT, userAgent TEXT
);
CREATE INDEX session_user ON session(userId);
CREATE TABLE account (
  id TEXT PRIMARY KEY, accountId TEXT NOT NULL, providerId TEXT NOT NULL, userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  accessToken TEXT, refreshToken TEXT, idToken TEXT, accessTokenExpiresAt DATE, refreshTokenExpiresAt DATE, scope TEXT, password TEXT,
  createdAt DATE NOT NULL, updatedAt DATE NOT NULL, UNIQUE(providerId, accountId)
);
CREATE INDEX account_user ON account(userId);
CREATE TABLE verification (
  id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, expiresAt DATE NOT NULL,
  createdAt DATE NOT NULL, updatedAt DATE NOT NULL
);
CREATE INDEX verification_identifier ON verification(identifier);
CREATE TABLE events (
  id TEXT PRIMARY KEY, host_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT NOT NULL, starts_at INTEGER NOT NULL, capacity INTEGER NOT NULL CHECK(capacity >= 1),
  visibility TEXT NOT NULL CHECK(visibility IN ('public', 'private')), category TEXT NOT NULL, location TEXT NOT NULL,
  invite_token TEXT UNIQUE
);
CREATE INDEX events_discovery ON events(visibility, starts_at);
CREATE INDEX events_host ON events(host_id);
CREATE TABLE event_covers (event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE, image BLOB NOT NULL);
CREATE TABLE rsvps (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  PRIMARY KEY(event_id, user_id)
);
CREATE INDEX rsvps_user ON rsvps(user_id);
CREATE TABLE grants (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, session_id TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL, PRIMARY KEY(event_id, session_id)
);
CREATE TABLE comments (
  id INTEGER PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, body TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX comments_event ON comments(event_id, id);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires_at INTEGER NOT NULL);
