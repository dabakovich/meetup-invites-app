import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { Worker } from "node:worker_threads";
import { createRequestHandler } from "react-router";
import { db } from "../app/server/db.server.ts";
import { dateInput } from "../app/model.ts";

const temp = mkdtempSync(join(tmpdir(), "tusovka-tests-"));
const origin = "https://tusovka.test";
process.env.DATABASE_PATH = join(temp, "integration.sqlite");
process.env.BETTER_AUTH_URL = origin;
process.env.BETTER_AUTH_SECRET = "integration-test-secret-isolated-to-a-temporary-database";
const handler = createRequestHandler(await import(resolve("build/server/index.js")), "production");
type Cookies = Map<string, string>;

function call(
  path: string,
  cookies = new Map<string, string>(),
  body?: FormData | URLSearchParams,
  requestOrigin = origin,
) {
  return handler(
    new Request(origin + path, {
      method: body ? "POST" : "GET",
      headers: { Origin: requestOrigin, Cookie: [...cookies.values()].join("; ") },
      body,
    }),
  ).then((response) => {
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0];
      cookies.set(pair.slice(0, pair.indexOf("=")), pair);
    }
    return response;
  });
}
async function signup(name: string, jar: Cookies = new Map()) {
  const response = await call(
    "/auth",
    jar,
    new URLSearchParams({
      mode: "signup",
      email: name + "@example.test",
      name,
      password: "reliable-password-2026",
      next: "/profile",
    }),
  );
  assert.equal(response.status, 303);
  return jar;
}
function eventForm(visibility = "private", title = "Тестова зустріч", capacity = 1, cover = true) {
  const form = new FormData();
  const fields = {
    visibility,
    title,
    category: "Музика",
    capacity: String(capacity),
    description: "Опис цієї події",
    location: "Київ",
    starts_at: dateInput(Date.now() + 3 * 86400000),
  };
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  if (cover)
    form.set(
      "cover",
      new Blob([new Uint8Array(readFileSync("public/art/music.webp"))], { type: "image/webp" }),
      "cover.webp",
    );
  return form;
}
function postIntent(path: string, jar: Cookies, intent: string, fields: Record<string, string> = {}) {
  return call(path, jar, new URLSearchParams({ intent, ...fields }));
}
async function profileMembership(cookies: Cookies, eventPath: string) {
  const response = await call("/profile", cookies);
  assert.equal(response.status, 200);
  const html = await response.text();
  const groups = [...html.matchAll(/<section class="profile-group"><h2>([^<]+)<\/h2>(.*?)<\/section>/gs)];
  assert.deepEqual(
    groups.map((group) => group[1]),
    ["Створені мною", "Я йду"],
  );
  return groups.map((group) => group[2].includes('href="' + eventPath + '"'));
}

after(() => {
  db().close();
  rmSync(temp, { recursive: true, force: true });
});

test("private events protect details, covers, comments and management across accounts and sessions", async () => {
  const host = await signup("host"),
    guest = await signup("guest"),
    stranger = await signup("stranger");
  const saved = await call("/events/new", host, eventForm());
  assert.equal(saved.status, 303);
  const path = saved.headers.get("Location")!;
  const id = path.split("/").pop()!;
  assert.ok(!(await (await call("/")).text()).includes("Тестова зустріч"));
  assert.equal((await call(path, stranger)).status, 404);
  assert.equal((await call(path + "/cover", stranger)).status, 404);
  assert.equal((await call(path + "/cover")).status, 404);
  assert.equal((await postIntent(path, stranger, "comment", { comment: "Привіт" })).status, 404);
  assert.equal((await call(path + "/cover", host)).headers.get("Content-Type"), "image/webp");
  const { invite_token: token } = db().prepare("SELECT invite_token FROM events WHERE id=?").get(id) as {
    invite_token: string;
  };
  assert.equal((await call("/invite/" + token, guest)).headers.get("Location"), path);
  assert.equal((await call(path, guest)).status, 200);
  assert.equal((await call(path + "/cover", guest)).status, 200);
  assert.ok(!(await (await call(path, guest)).text()).includes(token));
  assert.deepEqual(await profileMembership(host, path), [true, false]);
  assert.deepEqual(await profileMembership(guest, path), [false, false]);
  assert.deepEqual(await profileMembership(stranger, path), [false, false]);

  assert.equal((await call(path + "/edit", guest, eventForm("public", "Unwanted", 2))).status, 403);
  assert.equal((await postIntent(path, guest, "delete", { confirm: "yes" })).status, 403);
  assert.equal((await postIntent(path, guest, "rotate")).status, 403);
  assert.equal(
    (db().prepare("SELECT title FROM events WHERE id=?").get(id) as { title: string }).title,
    "Тестова зустріч",
  );
  const refused = await call(path, guest, new URLSearchParams({ intent: "join" }), "https://elsewhere.test");
  assert.ok([400, 403].includes(refused.status));
  assert.equal((db().prepare("SELECT COUNT(*) n FROM rsvps WHERE event_id=?").get(id) as { n: number }).n, 0);
  for (let i = 0; i < 2; i++) assert.equal((await postIntent(path, guest, "join")).status, 303);
  assert.deepEqual(await profileMembership(host, path), [true, false]);
  assert.deepEqual(await profileMembership(guest, path), [false, true]);
  assert.deepEqual(await profileMembership(stranger, path), [false, false]);
  assert.equal((db().prepare("SELECT COUNT(*) n FROM rsvps WHERE event_id=?").get(id) as { n: number }).n, 1);
  assert.equal((await postIntent(path, guest, "comment", { comment: "<b>Вітаю!</b>" })).status, 303);
  const guestPage = await (await call(path, guest)).text();
  assert.ok(guestPage.includes("&lt;b&gt;Вітаю!&lt;/b&gt;"));
  assert.ok(!guestPage.includes(">Учасники "));
  const anonymous: Cookies = new Map();
  assert.equal((await call("/invite/" + token, anonymous)).headers.get("Location"), "/auth");
  const login = await call(
    "/auth",
    anonymous,
    new URLSearchParams({
      mode: "signin",
      email: "stranger@example.test",
      password: "reliable-password-2026",
    }),
  );
  assert.equal(login.headers.get("Location"), "/auth");
  assert.equal((await call("/auth", anonymous)).headers.get("Location"), path);
  const failedBooking = await postIntent(path, anonymous, "join");
  assert.equal(failedBooking.status, 400);
  const booking =
    (await failedBooking.text()).match(/<section class="panel booking">(.*?)<\/section>/s)?.[1] ?? "";
  assert.ok(booking.includes("<strong>Місць немає</strong>"));
  assert.ok(booking.includes("Усі місця заброньовані"));
  assert.ok(booking.includes('role="alert">Місць немає'));
  const failedComment = await postIntent(path, guest, "comment", { comment: " " });
  const commentsSection =
    (await failedComment.text()).match(
      /<section class="panel detail-panel" id="comments">(.*?)<\/section>/s,
    )?.[1] ?? "";
  assert.ok(commentsSection.includes('role="alert"'));
  assert.equal((await postIntent("/logout", guest, "logout")).status, 303);
  await call(
    "/auth",
    guest,
    new URLSearchParams({ mode: "signin", email: "guest@example.test", password: "reliable-password-2026" }),
  );
  assert.ok((await (await call("/profile", guest)).text()).includes("Тестова зустріч"));
  assert.equal((await call(path, guest)).status, 200);
  assert.equal((await postIntent(path, guest, "cancel")).headers.get("Location"), "/profile");
  assert.equal((await postIntent(path, guest, "cancel")).status, 303);
  assert.equal((await call(path + "/cover", guest)).status, 404);
  assert.equal((await postIntent(path, host, "rotate")).status, 303);
  assert.equal((await call("/invite/" + token, stranger)).status, 404);
  assert.equal((await call(path, anonymous)).status, 404);
  const rotated = db().prepare("SELECT invite_token FROM events WHERE id=?").get(id) as {
    invite_token: string;
  };
  assert.equal((await call("/invite/" + rotated.invite_token, guest)).headers.get("Location"), path);
  assert.equal((await call(path + "/cover", guest)).status, 200);
  assert.equal(
    (await call(path + "/edit", host, eventForm("public", "Тестова зустріч", 2, false))).status,
    303,
  );
  assert.equal((await call(path, stranger)).status, 200);
  assert.equal(
    (await call(path + "/edit", host, eventForm("private", "Тестова зустріч", 2, false))).status,
    303,
  );
  assert.equal((await call(path, guest)).status, 404);
  assert.equal((await call(path + "/cover", guest)).status, 404);
  assert.equal((await call("/invite/" + rotated.invite_token, guest)).status, 404);
  assert.deepEqual(await profileMembership(guest, path), [false, false]);

  assert.equal((await postIntent(path, host, "delete", { confirm: "yes" })).status, 303);
  assert.equal((await call(path, host)).status, 404);
});

test("competing SQLite connections allocate exactly one seat and block capacity reductions below bookings", async () => {
  const host = await signup("secondhost");
  const guest1 = await signup("firstworker"),
    guest2 = await signup("secondworker");
  const save = await call("/events/new", host, eventForm("public", "Останнє місце"));
  assert.equal(save.status, 303);
  const path = save.headers.get("Location")!,
    eventId = path.split("/").pop()!;
  const workers = ["firstworker", "secondworker"].map((name) => {
    const user = db().prepare("SELECT id FROM user WHERE name=?").get(name) as { id: string };
    return new Worker(new URL("./reserve-worker.ts", import.meta.url), {
      workerData: { eventId, userId: user.id },
    });
  });
  try {
    await Promise.all(workers.map((worker) => once(worker, "message")));
    const outcomes = workers.map((worker) => once(worker, "message"));
    workers.forEach((worker) => worker.postMessage("reserve"));
    assert.deepEqual((await Promise.all(outcomes)).flat().sort(), ["booked", "Місць немає"]);
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }
  const cinema = eventForm("public", "Кіно під зорями");
  cinema.set("category", "Кіно");
  const other = await call("/events/new", host, cinema);
  assert.equal(other.status, 303);
  const otherPath = other.headers.get("Location")!;
  for (const [filters, expected] of [
    [{ q: "ОСТАННЄ" }, [true, false]],
    [{ category: "Кіно" }, [false, true]],
    [{ category: "Музика" }, [true, false]],
    [{ q: "ОСТАННЄ", category: "Кіно" }, [false, false]],
  ] as [Record<string, string>, boolean[]][]) {
    const html = await (await call("/?" + new URLSearchParams(filters))).text();
    assert.deepEqual(
      [path, otherPath].map((p) => html.includes('href="' + p + '"')),
      expected,
    );
  }
  assert.equal(
    (await call(path + "/edit", host, eventForm("public", "Останнє місце", 2, false))).status,
    303,
  );
  await postIntent(path, guest1, "join");
  await postIntent(path, guest2, "join");
  assert.equal(
    (await call(path + "/edit", host, eventForm("public", "Останнє місце", 1, false))).status,
    400,
  );
  const row = db().prepare("SELECT capacity FROM events WHERE id=?").get(eventId) as { capacity: number };
  assert.equal(row.capacity, 2);
  const bad = eventForm("public");
  bad.set("cover", new Blob(["invalid"], { type: "image/jpeg" }), "image.jpg");
  assert.equal((await call("/events/new", host, bad)).status, 400);
  const empty = eventForm("public", "Порожній файл", 2, false);
  empty.set("cover", new Blob([], { type: "image/webp" }), "empty.webp");
  assert.equal((await call(path + "/edit", host, empty)).status, 400);
  assert.equal((await call(path + "/cover", host)).status, 200);
});

test("discovery and comment pages return bounded rows and link to the next page", async () => {
  const host = await signup("pagination");
  const { id: hostId } = db().prepare("SELECT id FROM user WHERE name=?").get("pagination") as { id: string };
  const prefix = "Події для гортання ";
  const baseTime = Date.now() + 2 * 86400000;
  for (let n = 1; n <= 19; n++) {
    db()
      .prepare(
        `INSERT INTO events(id,host_id,title,description,starts_at,capacity,visibility,category,location)
      VALUES (?,?,?,'опис лише на сторінці події',?,1,'public','Зустріч','Київ')`,
      )
      .run("pagination-" + n, hostId, prefix + n, baseTime + n);
  }
  const query = new URLSearchParams({ q: prefix, category: "Зустріч" });
  const first = await (await call("/?" + query)).text();
  assert.ok(first.includes('href="/events/pagination-1"'));
  assert.ok(!first.includes('href="/events/pagination-19"'));
  assert.ok(!first.includes("опис лише на сторінці події"));
  assert.ok(first.includes("Наступна"));
  query.set("page", "2");
  const second = await (await call("/?" + query)).text();
  assert.ok(second.includes('href="/events/pagination-19"'));
  assert.ok(!second.includes('href="/events/pagination-1"'));
  assert.ok(second.includes("Попередня"));
  for (let n = 1; n <= 21; n++) {
    db()
      .prepare("INSERT INTO comments(event_id,user_id,body,created_at) VALUES ('pagination-1',?,?,?)")
      .run(hostId, "Коментар №" + n + ".", Date.now());
  }
  const latest = await (await call("/events/pagination-1", host)).text();
  assert.ok(latest.includes("Коментар №21."));
  assert.ok(!latest.includes("Коментар №1."));
  const earlier = await (await call("/events/pagination-1?page=2", host)).text();
  assert.ok(earlier.includes("Коментар №1."));
  assert.ok(!earlier.includes("Коментар №21."));
});

test("replayed keyed event and comment submissions produce one result, and reject conflicting reuse", async () => {
  const host = await signup("idempotency-host");
  const first = eventForm("public", "Ідемпотентна подія", 10);
  first.set("idempotency_key", "event-request-123");
  const saved = await call("/events/new", host, first);
  assert.equal(saved.status, 303);
  const replay = await call("/events/new", host, first);
  assert.equal(replay.status, 303);
  assert.equal(replay.headers.get("Location"), saved.headers.get("Location"));
  const conflicting = eventForm("public", "Інша подія", 10);
  conflicting.set("idempotency_key", "event-request-123");
  assert.equal((await call("/events/new", host, conflicting)).status, 400);
  const path = saved.headers.get("Location")!;
  const request = { comment: "Привіт", idempotency_key: "comment-request-123" };
  assert.equal((await postIntent(path, host, "comment", request)).status, 303);
  assert.equal((await postIntent(path, host, "comment", request)).status, 303);
  assert.equal((await postIntent(path, host, "comment", { ...request, comment: "Інший" })).status, 400);
  const eventId = path.split("/").pop();
  assert.equal((db().prepare("SELECT COUNT(*) n FROM comments WHERE event_id=?").get(eventId) as {n: number}).n, 1);
});

test("events more than two years away are rejected server-side", async () => {
  const host = await signup("date-limit-host");
  const form = eventForm("public", "Занадто далека подія");
  form.set("starts_at", "9999-01-01T12:00");
  assert.equal((await call("/events/new", host, form)).status, 400);
  assert.equal((db().prepare("SELECT COUNT(*) n FROM events WHERE title=?").get("Занадто далека подія") as {n: number}).n, 0);
  const html = await (await call("/events/new", host)).text();
  assert.match(html, /type="datetime-local"[^>]*max="\d{4}-\d{2}-\d{2}T\d{2}:\d{2}"/);
});

test("profile updates are scoped to the signed-in user and deletion removes personal data", async () => {
  const host = await signup("privacy-host");
  const guest = await signup("privacy-guest");
  const event = await call("/events/new", host, eventForm("public", "Privacy host event", 3));
  const path = event.headers.get("Location")!;
  const own = await call("/events/new", guest, eventForm("public", "Privacy guest event", 3));
  const ownPath = own.headers.get("Location")!;
  const id = path.split("/").pop()!;
  const guestId = (db().prepare("SELECT id FROM user WHERE email=?").get("privacy-guest@example.test") as { id: string }).id;
  await postIntent(path, guest, "join");
  assert.equal((await postIntent(path, guest, "comment", { comment: "До зустрічі" })).status, 303);
  assert.equal((await call("/profile", guest, new URLSearchParams({ intent: "rename", name: "Нове ім’я", userId: "other" }))).status, 303);
  assert.equal((db().prepare("SELECT name FROM user WHERE id=?").get(guestId) as { name: string }).name, "Нове ім’я");
  assert.equal((await call("/profile", guest, new URLSearchParams({ intent: "rename", name: " " }))).status, 400);
  assert.equal((await call("/profile", guest, new URLSearchParams({ intent: "delete" }))).status, 400);
  assert.ok([400, 403].includes((await call("/profile", guest, new URLSearchParams({ intent: "delete", confirm: "yes" }), "https://evil.test")).status));
  assert.equal((await call("/profile", guest, new URLSearchParams({ intent: "delete", confirm: "yes" }))).status, 303);
  assert.equal(db().prepare("SELECT id FROM user WHERE id=?").get(guestId), undefined);
  assert.equal(db().prepare("SELECT id FROM session WHERE userId=?").get(guestId), undefined);
  assert.equal(db().prepare("SELECT user_id FROM rsvps WHERE user_id=?").get(guestId), undefined);
  assert.equal((await call(ownPath, host)).status, 404);
  const comment = db().prepare("SELECT user_id, body FROM comments WHERE event_id=?").get(id) as { user_id: string | null; body: string };
  assert.equal(comment.user_id, null);
  assert.equal(comment.body, "До зустрічі");
  const html = await (await call(path, host)).text();
  assert.ok(html.includes("До зустрічі"));
  assert.equal((await call("/profile", guest)).status, 302);
});

test("comment reporting and moderation enforce event host and author permissions", async () => {
  const host = await signup("moderation-host");
  const author = await signup("moderation-author");
  const visitor = await signup("moderation-visitor");
  const event = await call("/events/new", host, eventForm("public", "Moderation test", 5));
  const path = event.headers.get("Location")!;
  const eventId = path.split("/").pop()!;
  assert.equal((await postIntent(path, author, "comment", { comment: "Коментар для скарги" })).status, 303);
  const commentId = String((db().prepare("SELECT id FROM comments WHERE event_id=? AND body=?").get(eventId, "Коментар для скарги") as { id: number }).id);
  const fields = { comment_id: commentId };
  const reported = await postIntent(path + "?page=2", visitor, "report-comment", fields);
  assert.equal(reported.status, 303);
  assert.equal(reported.headers.get("Location"), path + "?reported=1&page=2#comments");
  assert.equal((await postIntent(path, visitor, "report-comment", fields)).status, 303);
  const reports = () => (db().prepare("SELECT COUNT(*) n FROM comment_reports WHERE comment_id=?").get(commentId) as { n: number }).n;
  assert.equal(reports(), 1);
  assert.equal((await postIntent(path, visitor, "dismiss-reports", fields)).status, 403);
  assert.equal((await postIntent(path, visitor, "delete-comment", fields)).status, 403);
  assert.equal(reports(), 1);
  const hostPage = await (await call(path, host)).text();
  assert.ok(hostPage.includes("Коментар для скарги"));
  assert.equal((await postIntent(path, host, "dismiss-reports", fields)).status, 303);
  assert.equal(reports(), 0);
  assert.equal((await postIntent(path, visitor, "report-comment", fields)).status, 303);
  assert.equal((await postIntent(path, host, "delete-comment", fields)).status, 303);
  assert.equal(reports(), 0);
  assert.equal(db().prepare("SELECT id FROM comments WHERE id=?").get(commentId), undefined);
  assert.equal((await postIntent(path, author, "comment", { comment: "Власний коментар" })).status, 303);
  const ownId = String((db().prepare("SELECT id FROM comments WHERE event_id=? AND body=?").get(eventId, "Власний коментар") as { id: number }).id);
  assert.equal((await postIntent(path, author, "delete-comment", { comment_id: ownId })).status, 303);
  assert.equal(db().prepare("SELECT id FROM comments WHERE id=?").get(ownId), undefined);
});
