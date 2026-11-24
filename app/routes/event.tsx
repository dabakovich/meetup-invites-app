import { useEffect, useRef, useState } from "react";
import {
  Link,
  Form,
  data,
  redirect,
  useActionData,
  useFetcher,
  type ShouldRevalidateFunctionArgs,
  useLoaderData,
  useNavigation,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  MapPin,
  UsersRound,
  Ticket,
  Pencil,
  Send,
  Link2,
  Check,
  LockKeyhole,
  UserRound,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { actor, requireActor, appOrigin, readForm } from "../server/auth.server";
import {
  addComment,
  deleteEvent,
  details,
  rotateInvite,
  ValidationError,
  visibleEvent,
} from "../server/events.server";
import { reserve, cancel } from "../server/rsvps.server";
import { Pagination } from "../components/pagination";
import { dateParts, seats } from "../model";
export async function loader({ request, params }: LoaderFunctionArgs) {
  const who = await actor(request),
    page = details(params.id!, who, new URL(request.url).searchParams.get("page"));
  return {
    ...page,
    closedAtLoad: page.event.starts_at <= Date.now(),
    signedIn: !!who,
    inviteURL: page.token ? appOrigin + "/invite/" + page.token : null,
  };
}
export async function action({ request, params }: ActionFunctionArgs) {
  const who = await requireActor(request),
    id = params.id!,
    form = await readForm(request);
  const intent = String(form.get("intent") || "");
  try {
    switch (intent) {
      case "join":
        reserve(id, who);
        break;
      case "cancel":
        cancel(id, who);
        try {
          visibleEvent(id, who);
        } catch (e) {
          if (e instanceof Response && e.status === 404) return redirect("/profile", 303);
          throw e;
        }
        break;
      case "comment": {
        const commentId = addComment(id, who, String(form.get("comment") || ""));
        if (form.get("inline") === "yes") return data({ intent, commentId, error: null });
        break;
      }
      case "rotate":
        rotateInvite(id, who);
        break;
      case "delete":
        if (form.get("confirm") !== "yes") throw new ValidationError("Підтвердьте видалення події.");
        deleteEvent(id, who);
        return redirect("/profile", 303);
      default:
        throw new Response(null, { status: 400 });
    }
    return redirect("/events/" + id, 303);
  } catch (e) {
    if (e instanceof ValidationError)
      return data({ intent, error: e.message, commentId: null }, { status: 400 });
    throw e;
  }
}
export function shouldRevalidate({
  actionStatus,
  formData,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  const intent = formData?.get("intent");
  return (actionStatus === 400 && (intent === "join" || intent === "cancel")) || defaultShouldRevalidate;
}

function useBookingClosed(startsAt: number, closedAtLoad: boolean) {
  const [closed, setClosed] = useState(closedAtLoad);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    function update() {
      clearTimeout(timeout);
      const remaining = startsAt - Date.now();
      setClosed(remaining <= 0);
      if (remaining > 0) timeout = setTimeout(update, Math.min(remaining, 2_147_483_647));
    }
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [startsAt]);
  return closed;
}

function FormError({ message }: { message?: string | null }) {
  return message ? (
    <p className="form-error" role="alert">
      {message}
    </p>
  ) : null;
}

export default function EventPage() {
  const { event, host, organizer, joined, comments, commentPage, guests, inviteURL, signedIn, closedAtLoad } =
    useLoaderData<typeof loader>();
  const result = useActionData<typeof action>(),
    busy = useNavigation().state === "submitting";
  const [copy, setCopy] = useState(""),
    [showDelete, setShowDelete] = useState(false);
  const date = dateParts(event.starts_at),
    signIn = "/auth?next=/events/" + event.id;
  const closed = useBookingClosed(event.starts_at, closedAtLoad);
  const commentFetcher = useFetcher<typeof action>();
  const draft = useRef<HTMLTextAreaElement>(null);
  const submittedText = useRef("");
  const postedId = commentFetcher.data?.commentId;
  useEffect(() => {
    if (postedId && draft.current?.value === submittedText.current) draft.current.value = "";
  }, [postedId]);
  function errorFor(intent: string) {
    return result?.intent === intent ? result.error : null;
  }
  async function copyInvite() {
    if (!inviteURL) return;
    try {
      await navigator.clipboard.writeText(inviteURL);
      setCopy("done");
    } catch {
      setCopy("manual");
    }
  }
  return (
    <article className="subpage">
      <Link to="/" className="back">
        <ArrowLeft size={16} />
        Усі події
      </Link>
      <div className="detail-layout">
        <div className="detail-main">
          <div className="detail-image">
            <img src={"/events/" + event.id + "/cover"} alt="Обкладинка події" />
            <span className="event-category">
              <span />
              {event.category}
            </span>
          </div>
          <div className="detail-title">
            <h1>{event.title}</h1>
            {event.visibility === "private" && (
              <span className="private">
                <LockKeyhole size={14} />
                Приватна подія
              </span>
            )}
          </div>
          <div className="detail-meta">
            <span>
              <CalendarDays />
              {date.date}
            </span>
            <span>
              <Clock3 />
              {date.time} · Київ
            </span>
            {event.location && (
              <span>
                <MapPin />
                {event.location}
              </span>
            )}
          </div>
          <section className="panel detail-panel">
            <h2>Про подію</h2>
            <p className="prewrap">{event.description}</p>
            <p className="organizer">
              <UserRound size={16} />
              Організатор · {organizer}
            </p>
          </section>
          <section className="panel detail-panel" id="comments">
            <h2>
              Коментарі <span className="count">{commentPage.total}</span>
            </h2>
            {comments.length ? (
              comments.map((c) => (
                <div className="comment" key={c.id}>
                  <strong>{c.name}</strong>
                  <small>{dateParts(c.created_at).date}</small>
                  <p className="prewrap">{c.body}</p>
                </div>
              ))
            ) : (
              <p className="muted">Поки немає коментарів.</p>
            )}
            <Pagination page={commentPage.page} count={commentPage.count} section="comments" />
            {signedIn ? (
              <Form
                method="post"
                className="stack"
                key={event.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  submittedText.current = String(form.get("comment") || "");
                  form.set("inline", "yes");
                  commentFetcher.submit(form, { method: "post" });
                }}
              >
                <input type="hidden" name="intent" value="comment" />
                <label className="sr-only" htmlFor="comment">
                  Ваш коментар
                </label>
                <textarea
                  ref={draft}
                  name="comment"
                  id="comment"
                  rows={3}
                  required
                  maxLength={1500}
                  placeholder="Написати коментар…"
                />
                <FormError message={commentFetcher.data?.error || errorFor("comment")} />
                <button className="btn secondary" disabled={busy || commentFetcher.state !== "idle"}>
                  <Send size={15} />
                  Надіслати
                </button>
              </Form>
            ) : (
              <Link className="text-link" to={signIn}>
                Увійти, щоб залишити коментар
              </Link>
            )}
          </section>
          {host && (
            <section className="panel detail-panel">
              <h2>
                Учасники <span className="count">{guests?.length ?? 0}</span>
              </h2>
              {guests?.length ? (
                <ul className="guests">
                  {guests.map((g) => (
                    <li key={g.id}>
                      <UserRound size={16} />
                      {g.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Ще ніхто не забронював місце.</p>
              )}
            </section>
          )}
        </div>
        <aside className="detail-aside">
          <section className="panel booking">
            <div>
              <UsersRound size={19} />
              <strong>{seats(event.remaining)}</strong>
            </div>
            <p className="muted">
              {joined
                ? "Ви зареєстровані на подію"
                : closed
                  ? "Подія вже розпочалася"
                  : !event.remaining
                    ? "Усі місця заброньовані"
                    : "Доступно для бронювання"}
            </p>
            {joined ? (
              <Form method="post">
                <button className="btn secondary" name="intent" value="cancel" disabled={busy}>
                  Скасувати участь
                </button>
              </Form>
            ) : closed || !event.remaining ? (
              <button className="btn" disabled>
                {closed ? "Реєстрацію завершено" : "Місць немає"}
              </button>
            ) : signedIn ? (
              <Form method="post">
                <button className="btn primary" name="intent" value="join" disabled={busy}>
                  <Ticket size={17} />
                  Іду
                </button>
              </Form>
            ) : (
              <Link className="btn primary" to={signIn}>
                <Ticket size={17} />
                Іду
              </Link>
            )}
            <FormError message={errorFor("join") || errorFor("cancel")} />
          </section>
          {host && (
            <section className="panel host-actions">
              <h2>Керування подією</h2>
              <Link to={`/events/${event.id}/edit`} className="btn secondary">
                <Pencil size={15} />
                Редагувати
              </Link>
              {inviteURL && (
                <>
                  <button className="btn secondary" onClick={copyInvite}>
                    {copy === "done" ? <Check size={15} /> : <Link2 size={15} />}{" "}
                    {copy === "done" ? "Посилання скопійовано" : "Скопіювати посилання-запрошення"}
                  </button>
                  {copy === "manual" && (
                    <input
                      aria-label="Посилання-запрошення"
                      value={inviteURL}
                      readOnly
                      onFocus={(e) => e.target.select()}
                    />
                  )}
                  <Form method="post" onSubmit={() => setCopy("")}>
                    <button className="text-link" name="intent" value="rotate">
                      <RefreshCw size={14} />
                      Оновити запрошення
                    </button>
                    <FormError message={errorFor("rotate")} />
                  </Form>
                </>
              )}
              <div className="danger-zone">
                <FormError message={errorFor("delete")} />
                {showDelete ? (
                  <Form method="post" className="stack">
                    <strong>Видалити подію та всі бронювання?</strong>
                    <input type="hidden" name="intent" value="delete" />
                    <button className="btn danger" name="confirm" value="yes">
                      Так, видалити
                    </button>
                    <button className="text-link" type="button" onClick={() => setShowDelete(false)}>
                      Залишити подію
                    </button>
                  </Form>
                ) : (
                  <button className="text-link danger-text" onClick={() => setShowDelete(true)}>
                    <Trash2 size={15} />
                    Видалити подію
                  </button>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </article>
  );
}
