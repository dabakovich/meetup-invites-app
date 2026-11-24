import { randomUUID } from "node:crypto";
import { useEffect, useState } from "react";
import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import { ArrowLeft, ImagePlus, Save } from "lucide-react";
import { requireActor, readForm } from "../server/auth.server";
import { fields, hostEvent, processCover, saveEvent, ValidationError } from "../server/events.server";
import { categories, dateInput, latestEventDate } from "../model";
export async function loader({ request, params }: LoaderFunctionArgs) {
  const who = await requireActor(request);
  return { event: params.id ? hostEvent(params.id, who) : null, requestKey: randomUUID(), latestDate: latestEventDate() };
}
export async function action({ request, params }: ActionFunctionArgs) {
  const who = await requireActor(request);
  const existing = params.id ? hostEvent(params.id, who) : null;
  const form = await readForm(request, 5 * 1024 * 1024 + 32_768);
  try {
    const values = fields(form, existing?.starts_at);
    const cover = await processCover(form.get("cover"));
    const id = saveEvent(params.id, who, values, cover, String(form.get("idempotency_key") || request.headers.get("Idempotency-Key") || ""));
    return redirect("/events/" + id, { status: 303 });
  } catch (e) {
    if (e instanceof ValidationError) return data({ error: e.message }, { status: 400 });
    throw e;
  }
}
export default function Editor() {
  const { event, requestKey, latestDate } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>(),
    busy = useNavigation().state === "submitting";
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="editor-page subpage">
      <Link className="back" to={event ? "/events/" + event.id : "/"}>
        <ArrowLeft size={16} />
        До {event ? "події" : "афіші"}
      </Link>
      <h1>{event ? "Редагувати подію" : "Створити подію"}</h1>
      <Form
        method="post"
        encType="multipart/form-data"
        className="panel stack editor"
        key={event?.id ?? "new"}
      >
        {!event && <input type="hidden" name="idempotency_key" value={requestKey} />}
        <label>
          Назва події
          <input
            name="title"
            defaultValue={event?.title}
            placeholder="Як називається ваша подія?"
            maxLength={120}
            required
          />
        </label>
        <label>
          Опис
          <textarea
            name="description"
            rows={4}
            maxLength={5000}
            required
            defaultValue={event?.description}
            placeholder="Що відбуватиметься на зустрічі?"
          />
        </label>
        <div className="form-row">
          <label>
            Дата й час <small>за Києвом</small>
            <input
              type="datetime-local"
              name="starts_at"
              max={event && dateInput(event.starts_at) > latestDate ? dateInput(event.starts_at) : latestDate}
              required
              defaultValue={event ? dateInput(event.starts_at) : ""}
            />
          </label>
          <label>
            Кількість місць
            <input
              type="number"
              name="capacity"
              min={1}
              max={10000}
              defaultValue={event?.capacity ?? 10}
              required
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Місце проведення
            <input
              name="location"
              maxLength={180}
              defaultValue={event?.location}
              placeholder="Місто, локація"
            />
          </label>
          <label>
            Категорія
            <select name="category" defaultValue={event?.category ?? "Зустріч"}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="visibility">
          <legend>Видимість події</legend>
          <label>
            <input
              type="radio"
              name="visibility"
              value="public"
              defaultChecked={event?.visibility !== "private"}
            />
            Публічна
          </label>
          <label>
            <input
              type="radio"
              name="visibility"
              value="private"
              defaultChecked={event?.visibility === "private"}
            />
            Приватна
          </label>
        </fieldset>
        <label>
          Обкладинка
          <span className="upload">
            <ImagePlus size={23} />
            <span>
              Оберіть зображення <small>JPEG, PNG або WebP · до 5 МБ</small>
            </span>
            <input
              aria-label="Завантажити обкладинку"
              type="file"
              name="cover"
              accept="image/jpeg,image/png,image/webp"
              required={!event}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </span>
        </label>
        {(preview || event) && (
          <img
            className="upload-preview"
            src={preview || "/events/" + event?.id + "/cover"}
            alt="Перегляд обкладинки"
          />
        )}
        {result?.error && (
          <p className="form-error" role="alert">
            {result.error}
          </p>
        )}
        <button className="btn primary" disabled={busy}>
          <Save size={16} />
          {busy ? "Зберігаємо…" : event ? "Зберегти зміни" : "Створити подію"}
        </button>
      </Form>
    </div>
  );
}
