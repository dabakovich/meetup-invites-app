import { useState, useEffect, useRef } from "react";
import {
  Link,
  NavLink,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  Form,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
  useLocation,
  type LoaderFunctionArgs,
} from "react-router";
import { Compass, Plus, UserRound, LogOut, ChevronDown, Ticket, ArrowLeft } from "lucide-react";
import { actor } from "./server/auth.server";
import "./style.css";

export async function loader({ request }: LoaderFunctionArgs) {
  const who = await actor(request);
  return { name: who?.name ?? null };
}
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#f6f7fc" />
        
        <meta
          name="description"
          content="Тусовка — українська афіша подій. Знаходь зустрічі та запрошуй своїх."
        />
        <title>Тусовка — події та зустрічі</title>
        <link rel="icon" href="/ticket.svg" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Тусовка, головна">
      <img src="/ticket.svg" alt="" width="36" height="36" />
      <span>Тусовка</span>
    </Link>
  );
}
export default function Root() {
  const { name } = useLoaderData<typeof loader>();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <>
      <a className="skip" href="#main">
        До вмісту
      </a>
      <header className="topbar">
        <div className="nav-wrap">
          <Brand />
          <nav className="main-links" aria-label="Головна навігація">
            <NavLink to="/" end>
              <Compass size={17} />
              Події
            </NavLink>
            <NavLink to="/events/new">
              <Plus size={18} />
              Створити
            </NavLink>
          </nav>
          {name ? (
            <div className="account" ref={menu}>
              <button className="account-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
                <UserRound size={16} />
                <span>Профіль</span>
                <ChevronDown size={13} />
              </button>
              {open && (
                <div className="dropdown">
                  <strong>{name}</strong>
                  <Link to="/profile">
                    <UserRound size={16} />
                    Мій профіль
                  </Link>
                  <Form method="post" action="/logout">
                    <button>
                      <LogOut size={16} />
                      Вийти
                    </button>
                  </Form>
                </div>
              )}
            </div>
          ) : (
            <Link className="account-btn" to={"/auth?next=" + encodeURIComponent(location.pathname)}>
              <UserRound size={16} />
              Увійти
            </Link>
          )}
        </div>
      </header>
      <main id="main" className="page">
        <Outlet />
      </main>
      <footer>
        <div className="footer-wrap">
          <Brand />
          <span>Українська спільнота подій</span>
          <Link to="/rules">Правила спільноти</Link>
        </div>
      </footer>
    </>
  );
}
export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message =
    status === 404
      ? "Подія недоступна"
      : status === 403
        ? "Доступ обмежено"
        : status === 413
          ? "Файл завеликий"
          : "Не вдалося відкрити сторінку";
  return (
    <div className="error-screen">
      <Brand />
      <Ticket size={44} />
      <h1>{message}</h1>
      <p>
        {status === 404
          ? "Перевірте посилання або поверніться до афіші."
          : "Спробуйте ще раз або поверніться до подій."}
      </p>
      <Link className="btn primary" to="/">
        <ArrowLeft size={16} />
        До подій
      </Link>
    </div>
  );
}
