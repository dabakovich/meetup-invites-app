import { createHash } from "node:crypto";
import { db } from "./db.server.ts";

// Called inside the same immediate transaction as the operation itself.
export function idempotencyKey(key: string, payload: unknown) {
  if (!key) return null;
  if (key.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(key)) throw new Error("INVALID_IDEMPOTENCY_KEY");
  return { key, fingerprint: createHash("sha256").update(JSON.stringify(payload)).digest("hex") };
}
export function previousResult(userId: string, operation: string, entry: ReturnType<typeof idempotencyKey>) {
  if (!entry) return null;
  const previous = db().prepare("SELECT fingerprint, result FROM idempotency_keys WHERE user_id=? AND operation=? AND key=?")
    .get(userId, operation, entry.key) as { fingerprint: string; result: string } | undefined;
  if (previous && previous.fingerprint !== entry.fingerprint) throw new Error("IDEMPOTENCY_CONFLICT");
  return previous?.result ?? null;
}
export function saveResult(userId: string, operation: string, entry: ReturnType<typeof idempotencyKey>, result: string) {
  if (entry) db().prepare("INSERT INTO idempotency_keys VALUES (?, ?, ?, ?, ?)")
    .run(userId, operation, entry.key, entry.fingerprint, result);
}
