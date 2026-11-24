import { Link, useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  count,
  section,
}: {
  page: number;
  count: number;
  section: "events" | "comments";
}) {
  const [search] = useSearchParams();
  if (count < 2) return null;
  function href(n: number) {
    const params = new URLSearchParams(search);
    params.set("page", String(n));
    return "?" + params.toString() + "#" + section;
  }
  return (
    <nav className="pagination" aria-label={section === "events" ? "Сторінки подій" : "Сторінки коментарів"}>
      {page > 1 && (
        <Link className="text-link" to={href(page - 1)}>
          <ChevronLeft size={14} />
          Попередня
        </Link>
      )}
      <span>
        Сторінка {page} із {count}
      </span>
      {page < count && (
        <Link className="text-link" to={href(page + 1)}>
          Наступна
          <ChevronRight size={14} />
        </Link>
      )}
    </nav>
  );
}
