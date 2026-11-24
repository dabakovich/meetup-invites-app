import {
  Form,
  Link,
  data,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { ArrowRight, ArrowLeft, Ticket, Mail, KeyRound } from "lucide-react";
import { auth, actor, safeReturn, appOrigin, limit, pendingInvite, readForm } from "../server/auth.server";
import { redeem } from "../server/events.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url),
    next = safeReturn(url.searchParams.get("next"));
  const who = await actor(request);
  if (who) {
    const pending = await pendingInvite.parse(request.headers.get("Cookie"));
    if (typeof pending === "string" && pending) {
      // Clear expired or rotated pending links as well, so subsequent sign-ins work normally.
      const headers = { "Set-Cookie": await pendingInvite.serialize("", { maxAge: 0 }) };
      try {
        return redirect("/events/" + redeem(pending, who), { headers });
      } catch (e) {
        if (e instanceof Response && e.status === 404)
          throw new Response("Подія недоступна.", { status: 404, headers });
        throw e;
      }
    }
    return redirect(next);
  }
  return { next, signup: url.searchParams.get("mode") === "signup", privacyController: process.env.PRIVACY_CONTROLLER || "", privacyContact: process.env.PRIVACY_CONTACT || "" };
}
export async function action({ request }: ActionFunctionArgs) {
  const form = await readForm(request);
  const email = String(form.get("email") || "")
    .trim()
    .toLowerCase();
  const name = String(form.get("name") || "").trim(),
    password = String(form.get("password") || "");
  const signup = form.get("mode") === "signup",
    next = safeReturn(form.get("next"));
  const fail = (message: string, status = 400) => data({ error: message, email, name }, { status });
  if (
    !email ||
    email.length > 254 ||
    !password ||
    password.length > 128 ||
    (signup && (!name || name.length > 80 || password.length < 10))
  )
    return fail("Перевірте поля форми. Пароль для реєстрації має містити щонайменше 10 символів.");
  const client = process.env.NODE_ENV === "production" ? request.headers.get("x-tusovka-client-address") : "local";
  if (!limit("auth-client:" + (client || "local"), 60, 60_000) || !limit("auth:" + email, 12, 60_000))
    return fail("Забагато спроб. Зачекайте хвилину.", 429);
  const result = await auth.handler(
    new Request(appOrigin + "/api/auth/" + (signup ? "sign-up" : "sign-in") + "/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: appOrigin },
      body: JSON.stringify({ email, password, ...(signup ? { name } : {}) }),
    }),
  );
  if (!result.ok)
    return fail(
      signup
        ? "Не вдалося створити акаунт. Перевірте дані або увійдіть."
        : "Невірна електронна адреса або пароль.",
      result.status === 429 ? 429 : 400,
    );
  const headers = new Headers();
  for (const cookie of result.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
  const pending = await pendingInvite.parse(request.headers.get("Cookie"));
  return redirect(typeof pending === "string" && pending ? "/auth" : next, { headers, status: 303 });
}
export default function Auth() {
  const { signup, next, privacyController, privacyContact } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const busy = useNavigation().state === "submitting";
  const alternate = "/auth?next=" + encodeURIComponent(next) + (signup ? "" : "&mode=signup");
  return (
    <div className="narrow auth-page">
      <Link className="back" to="/">
        <ArrowLeft size={16} />
        До подій
      </Link>
      <section className="panel auth-box">
        <div className="panel-icon">
          <Ticket size={27} />
        </div>
        <h1>{signup ? "Створити акаунт" : "З поверненням!"}</h1>
        <p className="muted">
          {signup
            ? "Приєднуйтеся, щоб відвідувати й створювати події."
            : "Увійдіть, щоб повернутися до своїх подій."}
        </p>
        <div className="auth-tabs">
          <Link
            className={!signup ? "selected" : ""}
            to={signup ? alternate : "/auth?next=" + encodeURIComponent(next)}
          >
            Вхід
          </Link>
          <Link
            className={signup ? "selected" : ""}
            to={!signup ? alternate : "/auth?mode=signup&next=" + encodeURIComponent(next)}
          >
            Реєстрація
          </Link>
        </div>
        <Form method="post" className="stack" key={String(signup)}>
          <input type="hidden" name="mode" value={signup ? "signup" : "signin"} />
          <input type="hidden" name="next" value={next} />
          {signup && (
            <label>
              Ваше ім’я
              <input name="name" maxLength={80} required autoComplete="name" defaultValue={result?.name} />
            </label>
          )}
          <label>
            Електронна адреса
            <span className="field-icon">
              <Mail size={17} />
              <input
                type="email"
                name="email"
                required
                maxLength={254}
                defaultValue={result?.email}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </span>
          </label>
          <label>
            Пароль
            <span className="field-icon">
              <KeyRound size={17} />
              <input
                type="password"
                name="password"
                required
                maxLength={128}
                minLength={signup ? 10 : 1}
                autoComplete={signup ? "new-password" : "current-password"}
                placeholder={signup ? "Щонайменше 10 символів" : "Ваш пароль"}
              />
            </span>
          </label>
          {signup && (
            <details>
              <summary>Як ми обробляємо персональні дані</summary>
              <p>Ім’я та електронну адресу використовуємо для створення акаунта, входу, участі у подіях і відображення вашого імені іншим учасникам. Пароль зберігається у вигляді хешу. Дані обробляються сервісом та постачальниками його хостингу.</p>
              <p>Ви можете змінити ім’я або видалити акаунт у профілі. При видаленні також видаляються ваші події, бронювання та сеанси; коментарі в інших подіях залишаються без прив’язки до акаунта.</p>
              {privacyController && <p>Володілець даних: {privacyController}.</p>}
              {privacyContact && <p>Питання щодо персональних даних: {privacyContact}.</p>}
            </details>
          )}
          {result?.error && (
            <p className="form-error" role="alert">
              {result.error}
            </p>
          )}
          <button className="btn primary" disabled={busy}>
            {signup ? "Зареєструватися" : "Увійти"}
            <ArrowRight size={16} />
          </button>
        </Form>
      </section>
    </div>
  );
}
