import { useEffect, useState } from "react";
import { Form, Link, useLoaderData, useSubmit, type LoaderFunctionArgs } from "react-router";
import { ArrowDown, Search, X, SlidersHorizontal, ChevronDown, Compass } from "lucide-react";
import { discover } from "../server/events.server";
import { Pagination } from "../components/pagination";
import { EventCards } from "../components/cards";
import { categories } from "../model";
export function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 120);
  const category = url.searchParams.get("category") ?? "";
  return { ...discover(q, category, url.searchParams.get("page")), q, category };
}
export default function Discover() {
  const { events, total, page, count, q, category } = useLoaderData<typeof loader>();
  const [text, setText] = useState(q);
  const submit = useSubmit();
  useEffect(() => {
    setText(q);
  }, [q]);
  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <span className="hero-kicker">
            <span className="live-dot" />
            Культурна афіша
          </span>
          <h1>
            Зустрічайся <em>наживо.</em>
          </h1>
          <p>
            Музика, майстер-класи й кіновечори.
            <br />
            Знаходь цікаві події та свою компанію.
          </p>
          <a href="#events" className="hero-link">
            До подій <ArrowDown size={15} />
          </a>
        </div>
      </section>
      <section id="events" className="catalog">
        <div className="catalog-header">
          <div className="heading-row">
            <h2>Найближчі події</h2>
            <span className="count" aria-label={total + " подій"}>
              {total}
            </span>
          </div>
          <Form
            method="get"
            className="filters"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              submit(e.currentTarget, { preventScrollReset: true });
            }}
          >
            <label className="search">
              <button aria-label="Шукати за назвою">
                <Search size={17} />
              </button>
              <input
                type="search"
                name="q"
                placeholder="Пошук подій…"
                aria-label="Пошук подій за назвою"
                maxLength={120}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  submit(e.currentTarget.form, { preventScrollReset: true, replace: true });
                }}
              />
            </label>
            <label className="filter-select">
              <SlidersHorizontal size={15} />
              <select
                name="category"
                aria-label="Категорія подій"
                value={category}
                onChange={(e) => submit(e.currentTarget.form, { preventScrollReset: true })}
              >
                <option value="">Усі категорії</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
          </Form>
        </div>
        {events.length ? (
          <>
            <EventCards events={events} />
            <Pagination page={page} count={count} section="events" />
          </>
        ) : (
          <div className="empty">
            <Compass />
            <h3>{q || category ? "Подій не знайдено" : "Попереду нові зустрічі"}</h3>
            <p>
              {q || category
                ? "Спробуйте іншу назву чи категорію."
                : "Створіть першу подію для своєї спільноти."}
            </p>
            <Link className="btn secondary" to={q || category ? "/" : "/events/new"}>
              {q || category ? (
                <>
                  <X size={15} />
                  Скинути пошук
                </>
              ) : (
                "Створити подію"
              )}
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
