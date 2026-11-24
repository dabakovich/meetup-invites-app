import type { LoaderFunctionArgs } from "react-router";
import { actor } from "../server/auth.server";
import { eventCover } from "../server/events.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const cover = eventCover(params.id!, await actor(request));
  return new Response(new Uint8Array(cover), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie",
    },
  });
}
