import { randomUUID, randomBytes } from "node:crypto";
import sharp from "sharp";
import { categories, parseKyivDate, latestEventDate, dateInput, type Gathering, type EventSummary, type EventFields } from "../model.ts";
import type { Actor } from "./auth.server.ts";
import { db } from "./db.server.ts";
import { idempotencyKey, previousResult, saveResult } from "./idempotency.server.ts";

export const unavailable = () => new Response("Подія недоступна.", { status: 404 });
const summaryColumns = "e.id, e.title, e.starts_at, e.category, e.location";
const availability = "e.capacity - (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = e.id) AS remaining";
const summaries = `SELECT ${summaryColumns}, ${availability} FROM events e`;
const columns = `SELECT ${summaryColumns}, e.host_id, e.description, e.capacity, e.visibility, ${availability} FROM events e`;

function pageWindow(requested: string | null, total: number, size: number) {
  const count = Math.max(1, Math.ceil(total / size));
  const n = Number(requested);
  const page = Number.isSafeInteger(n) ? Math.min(Math.max(1, n), count) : 1;
  return { page, count, offset: (page - 1) * size };
}

export function discover(query: string, category: string, requested: string | null) {
  const filter = ` WHERE visibility = 'public' AND starts_at >= ? AND instr(fold(title), fold(?)) > 0
    AND (? = '' OR category = ?)`;
  const args = [Date.now(), query.trim(), category, category];
  return db()
    .transaction(() => {
      const { total } = db()
        .prepare("SELECT COUNT(*) AS total FROM events" + filter)
        .get(...args) as { total: number };
      const size = 18;
      const { page, count, offset } = pageWindow(requested, total, size);
      const events = db()
        .prepare(summaries + filter + " ORDER BY starts_at, e.id LIMIT ? OFFSET ?")
        .all(...args, size, offset) as EventSummary[];
      return { events, total, page, count };
    })
    .deferred();
}
export function profile(userId: string) {
  return {
    hosted: db()
      .prepare(summaries + " WHERE host_id = ? ORDER BY starts_at DESC")
      .all(userId) as EventSummary[],
    attending: db()
      .prepare(
        summaries +
          " WHERE EXISTS (SELECT 1 FROM rsvps WHERE event_id = e.id AND user_id = ?) ORDER BY starts_at",
      )
      .all(userId) as EventSummary[],
  };
}
export function visibleEvent(id: string, who: Actor | null) {
  const event = db()
    .prepare(
      columns +
        ` WHERE e.id = ? AND (visibility = 'public' OR host_id = ?
    OR EXISTS (SELECT 1 FROM rsvps WHERE event_id = e.id AND user_id = ?)
    OR EXISTS (SELECT 1 FROM grants g JOIN session s ON s.id = g.session_id WHERE g.event_id = e.id AND s.userId = ? AND s.id = ? AND g.expires_at > ?))`,
    )
    .get(id, who?.id ?? null, who?.id ?? null, who?.id ?? null, who?.sessionId ?? null, Date.now()) as
    Gathering | undefined;
  if (!event) throw unavailable();
  return event;
}
export function hostEvent(id: string, who: Actor) {
  const event = visibleEvent(id, who);
  if (event.host_id !== who.id) throw new Response("Лише для організатора.", { status: 403 });
  return event;
}
export function eventCover(id: string, who: Actor | null) {
  return db()
    .transaction(() => {
      visibleEvent(id, who);
      const cover = db().prepare("SELECT image FROM event_covers WHERE event_id=?").get(id) as
        { image: Buffer } | undefined;
      if (!cover) throw unavailable();
      return cover.image;
    })
    .deferred();
}
export function details(id: string, who: Actor | null, requested: string | null) {
  return db()
    .transaction(() => {
      const event = visibleEvent(id, who);
      const host = who?.id === event.host_id;
      const { total } = db().prepare("SELECT COUNT(*) AS total FROM comments WHERE event_id=?").get(id) as {
        total: number;
      };
      const size = 20;
      const { page, count, offset } = pageWindow(requested, total, size);
      return {
        event,
        host,
        joined: !!db()
          .prepare("SELECT 1 FROM rsvps WHERE event_id = ? AND user_id = ?")
          .get(id, who?.id ?? null),
        organizer: (db().prepare("SELECT name FROM user WHERE id = ?").get(event.host_id) as { name: string })
          .name,
        commentPage: { page, count, total },
        comments: db()
          .prepare(
            "SELECT c.id, COALESCE(u.name, 'Видалений користувач') AS name, c.body, c.created_at, c.user_id = ? AS own, (SELECT COUNT(*) FROM comment_reports r WHERE r.comment_id = c.id) AS reports FROM comments c LEFT JOIN user u ON u.id = c.user_id WHERE c.event_id = ? ORDER BY c.id DESC LIMIT ? OFFSET ?",
          )
          .all(who?.id ?? null, id, size, offset) as { id: number; name: string; body: string; created_at: number; own: number; reports: number }[],
        reportedComments: host
          ? db().prepare("SELECT c.id, c.body, COUNT(r.reporter_id) AS reports FROM comments c JOIN comment_reports r ON r.comment_id = c.id WHERE c.event_id = ? GROUP BY c.id ORDER BY MAX(r.created_at) DESC, c.id DESC LIMIT 50").all(id) as { id: number; body: string; reports: number }[]
          : [],
        guests: host
          ? (db()
              .prepare(
                "SELECT u.id, u.name FROM rsvps r JOIN user u ON u.id = r.user_id WHERE event_id = ? ORDER BY u.name",
              )
              .all(id) as { id: string; name: string }[])
          : null,
        token: host
          ? (
              db().prepare("SELECT invite_token FROM events WHERE id = ?").get(id) as {
                invite_token: string | null;
              }
            ).invite_token
          : null,
      };
    })
    .deferred();
}
export function inviteEventId(token: string) {
  const found = db()
    .prepare("SELECT id FROM events WHERE invite_token = ? AND visibility = 'private'")
    .get(token) as { id: string } | undefined;
  if (!found) throw unavailable();
  return found.id;
}
export function redeem(token: string, who: Actor) {
  return db()
    .transaction(() => {
      const eventId = inviteEventId(token);
      db()
        .prepare(
          "INSERT INTO grants VALUES (?, ?, ?) ON CONFLICT(event_id, session_id) DO UPDATE SET expires_at = excluded.expires_at",
        )
        .run(eventId, who.sessionId, Date.now() + 86_400_000);
      return eventId;
    })
    .immediate();
}
export function rotateInvite(id: string, who: Actor) {
  db()
    .transaction(() => {
      const event = hostEvent(id, who);
      if (event.visibility !== "private") throw unavailable();
      db()
        .prepare("UPDATE events SET invite_token = ? WHERE id = ?")
        .run(randomBytes(32).toString("base64url"), id);
      db().prepare("DELETE FROM grants WHERE event_id = ?").run(id);
    })
    .immediate();
}
export class ValidationError extends Error {}
export function fields(form: FormData, existingStartsAt?: number, now = Date.now()): EventFields {
  const val = (key: string) => String(form.get(key) ?? "").trim();
  const title = val("title"),
    description = val("description"),
    location = val("location"),
    category = val("category");
  const starts_at = parseKyivDate(val("starts_at")),
    capacity = Number(val("capacity")),
    visibility = val("visibility");
  if (!title || title.length > 120 || !description || description.length > 5000 || location.length > 180)
    throw new ValidationError("Перевірте назву, опис і місце проведення.");
  if (!Number.isFinite(starts_at) || starts_at <= now)
    throw new ValidationError("Оберіть майбутню дату й час за Києвом.");
  if (val("starts_at") > latestEventDate(now) &&
      (existingStartsAt === undefined || val("starts_at") !== dateInput(existingStartsAt)))
    throw new ValidationError("Подію можна запланувати не більше ніж на два роки вперед.");
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000)
    throw new ValidationError("Кількість місць має бути від 1 до 10 000.");
  if ((visibility !== "public" && visibility !== "private") || !categories.some((c) => c === category))
    throw new ValidationError("Оберіть видимість та категорію.");
  return { title, description, location, category, starts_at, capacity, visibility };
}
export async function processCover(file: FormDataEntryValue | null) {
  if (!file || (typeof file !== "string" && file.name === "" && file.size === 0)) return null;
  if (typeof file === "string" || file.size === 0)
    throw new ValidationError("Файл обкладинки порожній або некоректний.");
  if (file.size > 5 * 1024 * 1024) throw new ValidationError("Зображення має бути до 5 МБ.");
  try {
    const input = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 24_000_000 });
    const meta = await input.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format || "") || (meta.pages || 1) > 1) throw Error();
    return await input
      .rotate()
      .resize({ width: 1600, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 83 })
      .toBuffer();
  } catch {
    throw new ValidationError("Завантажте коректний JPEG, PNG або WebP до 24 мегапікселів.");
  }
}
function keyFor(key: string, payload: unknown) {
  try { return idempotencyKey(key, payload); }
  catch (error) {
    if (error instanceof Error && error.message === "INVALID_IDEMPOTENCY_KEY")
      throw new ValidationError("Некоректний ключ повторного запиту.");
    throw error;
  }
}
function existingResult(userId: string, operation: string, entry: ReturnType<typeof idempotencyKey>) {
  try { return previousResult(userId, operation, entry); }
  catch (error) {
    if (error instanceof Error && error.message === "IDEMPOTENCY_CONFLICT")
      throw new ValidationError("Цей запит уже використано з іншими даними. Оновіть сторінку.");
    throw error;
  }
}
export function saveEvent(id: string | undefined, who: Actor, event: EventFields, cover: Buffer | null, key = "") {
  return db()
    .transaction(() => {
      const entry = !id ? keyFor(key, { event, cover: cover?.toString("base64") }) : null;
      const previousResult = existingResult(who.id, "event", entry);
      if (previousResult) return previousResult;
      const eventId = id || randomUUID();
      const previous = id ? hostEvent(id, who) : null;
      if (!id && !cover) throw new ValidationError("Додайте обкладинку події.");
      if (previous && event.capacity < previous.capacity - previous.remaining)
        throw new ValidationError("Уже заброньовано більше місць.");
      const token = event.visibility === "private" ? randomBytes(32).toString("base64url") : null;
      db()
        .prepare(
          `INSERT INTO events (id, host_id, title, description, starts_at, capacity, visibility, category, location, invite_token)
      VALUES (@id, @host_id, @title, @description, @starts_at, @capacity, @visibility, @category, @location, @token)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description, starts_at=excluded.starts_at,
      capacity=excluded.capacity, visibility=excluded.visibility, category=excluded.category, location=excluded.location,
      invite_token=CASE WHEN events.visibility = excluded.visibility THEN events.invite_token ELSE excluded.invite_token END`,
        )
        .run({ ...event, id: eventId, host_id: who.id, token });
      if (previous && previous.visibility !== event.visibility)
        db().prepare("DELETE FROM grants WHERE event_id=?").run(eventId);
      if (cover) db().prepare("INSERT OR REPLACE INTO event_covers VALUES (?, ?)").run(eventId, cover);
      saveResult(who.id, "event", entry, eventId);
      return eventId;
    })
    .immediate();
}
export function deleteEvent(id: string, who: Actor) {
  hostEvent(id, who);
  db().prepare("DELETE FROM events WHERE id=? AND host_id=?").run(id, who.id);
}
export function addComment(id: string, who: Actor, body: string, key = "") {
  return db()
    .transaction(() => {
      visibleEvent(id, who);
      if (!body.trim() || body.trim().length > 1500)
        throw new ValidationError("Напишіть від 1 до 1500 символів.");
      const entry = keyFor(key, { eventId: id, body: body.trim() });
      const previousResult = existingResult(who.id, "comment", entry);
      if (previousResult) return Number(previousResult);
      const now = Date.now();
      db().prepare("DELETE FROM comment_posts WHERE created_at <= ?").run(now - 60000);
      const count = db()
        .prepare("SELECT COUNT(*) AS n FROM comment_posts WHERE user_id=? AND created_at>?")
        .get(who.id, now - 60000) as { n: number };
      if (count.n >= 5) throw new ValidationError("Зачекайте хвилину перед наступним коментарем.");
      const saved = db()
        .prepare("INSERT INTO comments(event_id,user_id,body,created_at) VALUES (?,?,?,?)")
        .run(id, who.id, body.trim(), now);
      db().prepare("INSERT INTO comment_posts(user_id, created_at) VALUES (?, ?)").run(who.id, now);
      saveResult(who.id, "comment", entry, String(saved.lastInsertRowid));
      return Number(saved.lastInsertRowid);
    })
    .immediate();
}

export function deleteComment(eventId: string, who: Actor, commentId: number) {
  db().transaction(() => {
    const event = visibleEvent(eventId, who);
    const comment = db().prepare("SELECT user_id FROM comments WHERE id = ? AND event_id = ?").get(commentId, eventId) as { user_id: string | null } | undefined;
    if (!comment) throw unavailable();
    if (event.host_id !== who.id && comment.user_id !== who.id) throw new Response("Доступ обмежено.", { status: 403 });
    db().prepare("DELETE FROM comments WHERE id = ? AND event_id = ?").run(commentId, eventId);
  }).immediate();
}

export function reportComment(eventId: string, who: Actor, commentId: number) {
  db().transaction(() => {
    visibleEvent(eventId, who);
    if (!db().prepare("SELECT 1 FROM comments WHERE id = ? AND event_id = ?").get(commentId, eventId)) throw unavailable();
    db().prepare("INSERT OR IGNORE INTO comment_reports(comment_id, reporter_id, created_at) VALUES (?, ?, ?)").run(commentId, who.id, Date.now());
  }).immediate();
}

export function dismissCommentReports(eventId: string, who: Actor, commentId: number) {
  db().transaction(() => {
    hostEvent(eventId, who);
    db().prepare("DELETE FROM comment_reports WHERE comment_id = ? AND comment_id IN (SELECT id FROM comments WHERE event_id = ?)").run(commentId, eventId);
  }).immediate();
}
