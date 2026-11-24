import type { Actor } from "./auth.server.ts";
import { db } from "./db.server.ts";
import { visibleEvent, ValidationError } from "./events.server.ts";

export function reserve(id: string, who: Actor) {
  db()
    .transaction(() => {
      const event = visibleEvent(id, who);
      if (db().prepare("SELECT 1 FROM rsvps WHERE event_id=? AND user_id=?").get(id, who.id)) return;
      if (event.starts_at <= Date.now()) throw new ValidationError("Реєстрацію завершено.");
      if (!event.remaining) throw new ValidationError("Місць немає");
      db().prepare("INSERT INTO rsvps VALUES (?, ?)").run(id, who.id);
    })
    .immediate();
}
export function cancel(id: string, who: Actor) {
  db()
    .transaction(() => {
      // Deleting one's own row is idempotent even after private RSVP-based access has ended.
      db().prepare("DELETE FROM rsvps WHERE event_id=? AND user_id=?").run(id, who.id);
    })
    .immediate();
}
