import { redirect, type LoaderFunctionArgs } from "react-router";
import { actor, pendingInvite } from "../server/auth.server";
import { inviteEventId, redeem, unavailable } from "../server/events.server";
export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!params.token || !/^[\w-]{43}$/.test(params.token)) throw unavailable();
  const who = await actor(request);
  if (!who) {
    inviteEventId(params.token);
    return redirect("/auth", {
      headers: {
        "Set-Cookie": await pendingInvite.serialize(params.token),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }
  return redirect("/events/" + redeem(params.token, who), {
    headers: { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" },
  });
}

// A document route uses the same unavailable page as private event details.
export default function Invite() {
  return null;
}
