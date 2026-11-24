import { test } from "node:test";
import assert from "node:assert/strict";
import { dateInput, latestEventDate, parseKyivDate } from "../app/model.ts";
import { fields, ValidationError } from "../app/server/events.server.ts";

function eventForm(startsAt: string) {
  const form = new FormData();
  for (const [name, value] of Object.entries({
    title: "Тест", description: "Опис", location: "Київ", category: "Музика",
    starts_at: startsAt, capacity: "10", visibility: "public",
  })) form.set(name, value);
  return form;
}

test("two-year limit uses Kyiv local time and clamps leap day", () => {
  const leapDay = Date.parse("2028-02-29T10:00:00Z"); // 12:00 in Kyiv
  assert.equal(latestEventDate(leapDay), "2030-02-28T12:00");
  assert.equal(dateInput(fields(eventForm("2030-02-28T12:00"), undefined, leapDay).starts_at), "2030-02-28T12:00");
  assert.throws(() => fields(eventForm("2030-02-28T12:01"), undefined, leapDay), ValidationError);
  assert.equal(latestEventDate(Date.parse("2026-07-01T09:30:00Z")), "2028-07-01T12:30");
});

test("an existing event beyond the limit can retain its original date, but cannot move further", () => {
  const now = Date.parse("2028-02-29T10:00:00Z");
  const existing = parseKyivDate("2031-03-01T12:00");
  assert.equal(fields(eventForm("2031-03-01T12:00"), existing, now).starts_at, existing);
  assert.throws(() => fields(eventForm("2031-03-01T12:01"), existing, now), ValidationError);
  assert.throws(() => fields(eventForm("2031-03-01T12:00"), undefined, now), ValidationError);
});
