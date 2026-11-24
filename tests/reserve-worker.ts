import { parentPort, workerData } from "node:worker_threads";
import { db } from "../app/server/db.server.ts";
import { reserve } from "../app/server/rsvps.server.ts";

db();
parentPort!.postMessage("ready");
parentPort!.once("message", () => {
  try {
    reserve(workerData.eventId, { id: workerData.userId, sessionId: "unused-public-session", name: "Guest" });
    parentPort!.postMessage("booked");
  } catch (e) {
    parentPort!.postMessage(e instanceof Error ? e.message : "unexpected response");
  } finally {
    db().close();
  }
});
