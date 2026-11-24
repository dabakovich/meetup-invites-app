import { randomBytes, createHash } from "node:crypto";
import { betterAuth } from "better-auth";
import { createCookie, redirect } from "react-router";
import { db } from "./db.server.ts";

const production = process.env.NODE_ENV === "production";
export const appOrigin = new URL(process.env.BETTER_AUTH_URL || "http://localhost:5173").origin;
const configuredSecret = process.env.BETTER_AUTH_SECRET;
if (production && (!configuredSecret || configuredSecret.length < 32 || !process.env.BETTER_AUTH_URL)) {
  throw new Error("Set BETTER_AUTH_URL and a 32-character or longer BETTER_AUTH_SECRET in production.");
}
function localSecret() {
  return db()
    .transaction(() => {
      const row = db().prepare("SELECT value FROM app_settings WHERE key='dev_secret'").get() as
        { value: string } | undefined;
      if (row) return row.value;
      const value = randomBytes(48).toString("base64url");
      db().prepare("INSERT INTO app_settings VALUES ('dev_secret', ?)").run(value);
      return value;
    })
    .immediate();
}
const secret = configuredSecret || localSecret();
const secure = appOrigin.startsWith("https:");
if (production && !secure && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(appOrigin).hostname)) {
  throw new Error("BETTER_AUTH_URL must use HTTPS for a deployed instance.");
}
export const auth = betterAuth({
  baseURL: appOrigin,
  secret,
  database: db(),
  session: { expiresIn: 7 * 24 * 60 * 60, disableSessionRefresh: true },
  emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128 },
  advanced: { useSecureCookies: secure, defaultCookieAttributes: { httpOnly: true, sameSite: "lax" } },
  // Public auth requests enter through the form action, which enforces persistent account and site-wide limits.
  rateLimit: { enabled: false },
});
export const pendingInvite = createCookie("tusovka_pending", {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure,
  maxAge: 600,
  secrets: [secret],
});
export async function actor(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session ? { id: session.user.id, name: session.user.name, sessionId: session.session.id } : null;
}
export type Actor = NonNullable<Awaited<ReturnType<typeof actor>>>;
export function safeReturn(value: unknown) {
  return typeof value === "string" && /^\/(?:profile|events\/(?:new|[\w-]+(?:\/edit)?))$/.test(value)
    ? value
    : "/";
}
export async function requireActor(request: Request) {
  const user = await actor(request);
  if (!user) throw redirect("/auth?next=" + encodeURIComponent(safeReturn(new URL(request.url).pathname)));
  return user;
}
export function checkOrigin(request: Request) {
  if (request.method !== "POST") throw new Response(null, { status: 405, headers: { Allow: "POST" } });
  const origin = request.headers.get("Origin");
  if (
    origin !== appOrigin &&
    !(
      !production &&
      origin === new URL(request.url).origin &&
      ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)
    )
  ) {
    throw new Response("Запит відхилено.", { status: 403 });
  }
}
export function limit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hashed = createHash("sha256").update(key).digest("hex");
  return db()
    .transaction(() => {
      db().prepare("DELETE FROM rate_limits WHERE expires_at <= ?").run(now);
      const row = db()
        .prepare(
          "INSERT INTO rate_limits VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET hits = hits + 1 RETURNING hits",
        )
        .get(hashed, now + windowMs) as { hits: number };
      return row.hits <= max;
    })
    .immediate();
}
// Bound the stream itself. Chunked uploads may omit Content-Length.
export async function readForm(request: Request, max = 16_384) {
  checkOrigin(request);
  if (Number(request.headers.get("content-length")) > max)
    throw new Response("Завеликий файл.", { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) throw new Response(null, { status: 400 });
  let length = 0;
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > max) {
      await reader.cancel();
      throw new Response("Завеликий файл.", { status: 413 });
    }
    chunks.push(new Uint8Array(value));
  }
  try {
    return await new Response(new Blob(chunks), {
      headers: { "Content-Type": request.headers.get("Content-Type") || "" },
    }).formData();
  } catch {
    throw new Response("Некоректні дані форми.", { status: 400 });
  }
}
