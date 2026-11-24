import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "../app/server/db.server.ts";
import { addComment, deleteComment, details, dismissCommentReports, reportComment } from "../app/server/events.server.ts";

const temp = mkdtempSync(join(tmpdir(), "tusovka-moderation-"));
process.env.DATABASE_PATH = join(temp, "db.sqlite");
const users = ["host", "author", "reporter"].map((id) => ({ id, sessionId: id, name: id, email: `${id}@example.test` }));
for (const user of users) db().prepare("INSERT INTO user(id,name,email,createdAt,updatedAt) VALUES(?,?,?,?,?)").run(user.id, user.name, user.email, 0, 0);
db().prepare("INSERT INTO events(id,host_id,title,description,starts_at,capacity,visibility,category,location) VALUES ('event','host','test','test',?,10,'public','Музика','')").run(Date.now() + 100000);
after(() => { db().close(); rmSync(temp, { recursive: true, force: true }); });

test("reports reach the host and only the host or author can remove comments", () => {
  const [host, author, reporter] = users;
  const commentId = addComment("event", author, "A comment");
  reportComment("event", reporter, commentId);
  reportComment("event", reporter, commentId);
  assert.equal(details("event", host, null).reportedComments[0].reports, 1);
  assert.equal(details("event", reporter, null).reportedComments.length, 0);
  assert.throws(() => deleteComment("event", reporter, commentId), (e: unknown) => e instanceof Response && e.status === 403);
  assert.throws(() => dismissCommentReports("event", reporter, commentId), (e: unknown) => e instanceof Response && e.status === 403);
  dismissCommentReports("event", host, commentId);
  assert.equal(details("event", host, null).reportedComments.length, 0);
  reportComment("event", reporter, commentId);
  deleteComment("event", host, commentId);
  assert.equal((db().prepare("SELECT COUNT(*) AS n FROM comment_reports").get() as { n: number }).n, 0);
  const ownComment = addComment("event", author, "Another comment");
  deleteComment("event", author, ownComment);
  assert.equal(details("event", host, null).commentPage.total, 0);
});

test("private event comments and reports cannot be accessed without permission", () => {
  const [host, author, reporter] = users;
  db().prepare("INSERT INTO events(id,host_id,title,description,starts_at,capacity,visibility,category,location) VALUES ('private','host','private','test',?,10,'private','Музика','')").run(Date.now() + 100000);
  const commentId = addComment("private", host, "Private discussion");
  for (const action of [
    () => details("private", reporter, null),
    () => reportComment("private", reporter, commentId),
    () => deleteComment("private", reporter, commentId),
    () => dismissCommentReports("private", reporter, commentId),
  ]) assert.throws(action, (e: unknown) => e instanceof Response && e.status === 404);
  db().prepare("INSERT INTO rsvps(event_id,user_id) VALUES ('private','author')").run();
  reportComment("private", author, commentId);
  assert.equal(details("private", host, null).reportedComments.length, 1);
});

test("deleting comments does not reset the posting limit", () => {
  const [, author] = users;
  db().prepare("DELETE FROM comment_posts WHERE user_id = ?").run(author.id);
  for (let i = 0; i < 5; i++) {
    const id = addComment("event", author, `Temporary comment ${i}`);
    deleteComment("event", author, id);
  }
  assert.throws(() => addComment("event", author, "Sixth comment"), /Зачекайте хвилину/);
  db().prepare("UPDATE comment_posts SET created_at = ? WHERE user_id = ?").run(Date.now() - 61000, author.id);
  assert.doesNotThrow(() => addComment("event", author, "After the window"));
});

test("the host's report queue is capped and older reports become visible after moderation", () => {
  const [host, author, reporter] = users;
  const insertComment = db().prepare("INSERT INTO comments(event_id,user_id,body,created_at) VALUES ('event',?,?,?)");
  const insertReport = db().prepare("INSERT INTO comment_reports(comment_id,reporter_id,created_at) VALUES (?,?,?)");
  const ids: number[] = [];
  for (let i = 0; i < 51; i++) {
    const id = Number(insertComment.run(author.id, `Reported ${i}`, i).lastInsertRowid);
    insertReport.run(id, reporter.id, i);
    ids.push(id);
  }
  const first = details("event", host, null).reportedComments;
  assert.equal(first.length, 50);
  assert.ok(!first.some((c) => c.id === ids[0]));
  dismissCommentReports("event", host, ids[50]);
  assert.ok(details("event", host, null).reportedComments.some((c) => c.id === ids[0]));
});
