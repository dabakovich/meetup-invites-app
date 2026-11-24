import { useLoaderData, Form, Link, type LoaderFunctionArgs } from "react-router";
import { CalendarPlus, LogOut, Ticket, UserRound } from "lucide-react";
import { requireActor } from "../server/auth.server";
import { profile } from "../server/events.server";
import { EventCards } from "../components/cards";
export async function loader({ request }: LoaderFunctionArgs) {
  const who = await requireActor(request);
  return { name: who.name, ...profile(who.id) };
}
export default function Profile() {
  const { name, hosted, attending } = useLoaderData<typeof loader>();
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
