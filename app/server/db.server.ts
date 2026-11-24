import Database from "better-sqlite3";
import { closeSync, mkdirSync, openSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

export function openDatabase(filename = process.env.DATABASE_PATH || "data/tusovka.sqlite") {
  if (filename !== ":memory:") {
    const path = resolve(filename);
    if (["public", "build/client"].some(root => path.startsWith(resolve(root) + sep))) {
      throw new Error("DATABASE_PATH must be outside the public asset directories.");
    }
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    closeSync(openSync(path, "a", 0o600));
  }
  const connection = new Database(filename);
  connection.pragma("busy_timeout = 5000");
  connection.pragma("foreign_keys = ON");
  connection.pragma("journal_mode = WAL");
  connection.exec("CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)");
  connection
    .transaction(() => {
      const applied = connection.prepare("SELECT name FROM migrations WHERE name = ?");
      for (const name of readdirSync("migrations")
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        if (applied.get(name)) continue;
        connection.exec(readFileSync(resolve("migrations", name), "utf8"));
        connection.prepare("INSERT INTO migrations (name) VALUES (?)").run(name);
      }
    })
    .immediate();
  connection.function("fold", { deterministic: true }, (value: string) => value.toLocaleLowerCase("uk-UA"));
  return connection;
}

let connection: Database.Database | undefined;
export function db() {
  return (connection ??= openDatabase());
}
