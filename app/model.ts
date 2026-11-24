export const categories = ["Музика", "Майстер-клас", "Кіно", "Зустріч", "Інше"] as const;
export const timeZone = "Europe/Kyiv";
export type Gathering = {
  id: string;
  host_id: string;
  title: string;
  description: string;
  starts_at: number;
  capacity: number;
  visibility: "public" | "private";
  category: string;
  location: string;
  remaining: number;
};
export type EventSummary = Pick<
  Gathering,
  "id" | "title" | "starts_at" | "category" | "location" | "remaining"
>;
export type EventFields = Omit<Gathering, "id" | "host_id" | "remaining">;
export function dateInput(timestamp: number) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return parts.format(timestamp).replace(" ", "T");
}
export function parseKyivDate(value: string) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) return NaN;
  const naive = Date.parse(value + ":00Z");
  if (!Number.isFinite(naive)) return NaN;
  // Kyiv has UTC+02 and UTC+03 offsets. Verify the local representation across DST transitions.
  return [2, 3].map((offset) => naive - offset * 3_600_000).find((time) => dateInput(time) === value) ?? NaN;
}
export function dateParts(time: number) {
  const fmt = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("uk-UA", { timeZone, ...options }).format(time);
  return {
    day: fmt({ day: "2-digit" }),
    month: fmt({ month: "short" }).replace(".", ""),
    date: fmt({ day: "numeric", month: "long", year: "numeric" }),
    weekday: fmt({ weekday: "short" }),
    time: fmt({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  };
}
export function seats(n: number) {
  if (!n) return "Місць немає";
  const form = new Intl.PluralRules("uk").select(n);
  return n + " " + (form === "one" ? "місце" : form === "few" ? "місця" : "місць");
}
