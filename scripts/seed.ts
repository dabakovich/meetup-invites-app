import { readFileSync } from "node:fs";
import { db } from "../app/server/db.server.ts";
import { dateInput, parseKyivDate } from "../app/model.ts";

if (process.env.SEED_CATALOG !== "0") {
  const database = db();
  database
    .transaction(() => {
      database.exec("CREATE TABLE IF NOT EXISTS catalog_seed (version INTEGER PRIMARY KEY)");
      if (database.prepare("SELECT 1 FROM catalog_seed WHERE version=1").get()) return;
      const host = "tusovka-editorial";
      database
        .prepare("INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,0,?,?)")
        .run(
          host,
          "Редакція Тусовки",
          "editorial@tusovka.invalid",
          new Date().toISOString(),
          new Date().toISOString(),
        );
      const events = [
        {
          id: "vinyl-evening",
          title: "Вініловий вечір",
          category: "Музика",
          location: "Київ, Поділ",
          days: 3,
          time: "19:00",
          capacity: 18,
          cover: "music",
          description:
            "Слухаємо улюблені платівки й відкриваємо нові імена за одним програвачем. Принось свою платівку або просто заходь на вечір музики й розмов.",
        },
        {
          id: "clay-workshop",
          title: "Глина і руки",
          category: "Майстер-клас",
          location: "Львів, студія кераміки",
          days: 5,
          time: "12:00",
          capacity: 8,
          cover: "ceramics",
          description:
            "Знайомство з гончарним колом у затишній майстерні. Разом з майстринею створимо власну чашку. Матеріали входять до програми, досвід не потрібен.",
        },
        {
          id: "cinema-club",
          title: "Кіноклуб після титрів",
          category: "Кіно",
          location: "Київ, камерний кінозал",
          days: 6,
          time: "18:30",
          capacity: 24,
          cover: "cinema",
          description:
            "Збираємося на спільний перегляд українського кіно. Після фінальних титрів залишаємося, щоб обмінятися враженнями й поговорити про улюблені сцени.",
        },
      ];
      for (const event of events) {
        const day = dateInput(Date.now() + event.days * 86_400_000).slice(0, 10);
        database
          .prepare(
            `INSERT INTO events (id, host_id, title, description, starts_at, capacity, visibility, category, location)
        VALUES (?, ?, ?, ?, ?, ?, 'public', ?, ?)`,
          )
          .run(
            event.id,
            host,
            event.title,
            event.description,
            parseKyivDate(day + "T" + event.time),
            event.capacity,
            event.category,
            event.location,
          );
        database
          .prepare("INSERT INTO event_covers VALUES (?, ?)")
          .run(event.id, readFileSync("public/art/" + event.cover + ".webp"));
      }
      database.prepare("INSERT INTO catalog_seed VALUES(1)").run();
      console.log("Starter catalog created.");
    })
    .immediate();
}
