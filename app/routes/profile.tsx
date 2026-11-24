import { useLoaderData, useActionData, Form, Link, data, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { CalendarPlus, LogOut, Ticket, UserRound } from "lucide-react";
import { requireActor, readForm, auth, appOrigin, pendingInvite } from "../server/auth.server";
import { db } from "../server/db.server";
import { profile } from "../server/events.server";
import { EventCards } from "../components/cards";
export async function loader({ request }: LoaderFunctionArgs) {
  const who = await requireActor(request);
  return { name: who.name, ...profile(who.id) };
}
export async function action({ request }: ActionFunctionArgs) {
  const form = await readForm(request);
  const who = await requireActor(request);
  const intent = form.get("intent");
  if (intent === "rename") {
    const name = String(form.get("name") || "").trim();
    if (!name || name.length > 80) return data({ error: "Введіть ім’я довжиною до 80 символів." }, { status: 400 });
    db().prepare("UPDATE user SET name = ?, updatedAt = ? WHERE id = ?").run(name, Date.now(), who.id);
    return redirect("/profile", { status: 303 });
  }
  if (intent === "delete") {
    if (form.get("confirm") !== "yes") return data({ error: "Підтвердіть видалення акаунта." }, { status: 400 });
    // Sign out first so the browser also receives Better Auth's cookie expiration headers.
    const response = await auth.handler(new Request(appOrigin + "/api/auth/sign-out", {
      method: "POST",
      headers: { Origin: appOrigin, "Content-Type": "application/json", Cookie: request.headers.get("Cookie") || "" },
      body: "{}",
    }));
    if (!response.ok) throw new Response("Не вдалося видалити акаунт.", { status: 400 });
    db().prepare("DELETE FROM user WHERE id = ?").run(who.id);
    const headers = new Headers();
    for (const cookie of response.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
    headers.append("Set-Cookie", await pendingInvite.serialize("", { maxAge: 0 }));
    return redirect("/", { headers, status: 303 });
  }
  return data({ error: "Невідома дія." }, { status: 400 });
}
export default function Profile() {
  const { name, hosted, attending } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <div className="subpage">
      <div className="profile-head">
        <div className="panel-icon">
          <UserRound size={26} />
        </div>
        <div>
          <p className="muted">{name}</p>
          <h1>Мій профіль</h1>
        </div>
        <Form method="post" action="/logout">
          <button className="btn secondary">
            <LogOut size={16} />
            Вийти
          </button>
        </Form>
      </div>
      <section className="panel profile-settings">
        <h2>Налаштування акаунта</h2>
        {result?.error && <p className="form-error" role="alert">{result.error}</p>}
        <Form method="post" className="stack">
          <input type="hidden" name="intent" value="rename" />
          <label>Ваше ім’я<input name="name" defaultValue={name} maxLength={80} required /></label>
          <button className="btn secondary">Зберегти ім’я</button>
        </Form>
        <div className="profile-delete danger-zone">
          <h3>Видалити акаунт</h3>
          <p>Буде видалено ваш акаунт, сеанси, бронювання та створені вами події. Ваші коментарі в інших подіях залишаться без імені. Цю дію неможливо скасувати.</p>
          <Form method="post" className="stack">
            <input type="hidden" name="intent" value="delete" />
            <label className="profile-confirm"><input type="checkbox" name="confirm" value="yes" required /> Підтверджую видалення акаунта</label>
            <button className="btn danger">Видалити акаунт</button>
          </Form>
        </div>
      </section>
      <section className="profile-group">
        <h2>Створені мною</h2>
        {hosted.length ? (
          <EventCards events={hosted} />
        ) : (
          <div className="empty">
            <CalendarPlus />
            <p>Ви ще не створювали подій.</p>
            <Link to="/events/new" className="text-link">
              Створити подію
            </Link>
          </div>
        )}
      </section>
      <section className="profile-group">
        <h2>Я йду</h2>
        {attending.length ? (
          <EventCards events={attending} />
        ) : (
          <div className="empty">
            <Ticket />
            <p>У вас поки немає бронювань.</p>
            <Link to="/" className="text-link">
              Знайти подію
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
