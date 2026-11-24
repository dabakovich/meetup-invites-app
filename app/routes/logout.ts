import { redirect, type ActionFunctionArgs } from "react-router";
import { auth, appOrigin, checkOrigin, pendingInvite } from "../server/auth.server";

export async function action({ request }: ActionFunctionArgs) {
  checkOrigin(request);
  const response = await auth.handler(
    new Request(appOrigin + "/api/auth/sign-out", {
      method: "POST",
      headers: {
        Origin: appOrigin,
        "Content-Type": "application/json",
        Cookie: request.headers.get("Cookie") || "",
      },
      body: "{}",
    }),
  );
  if (!response.ok) throw new Response("Не вдалося вийти.", { status: 400 });
  const headers = new Headers();
  for (const value of response.headers.getSetCookie()) headers.append("Set-Cookie", value);
  headers.append("Set-Cookie", await pendingInvite.serialize("", { maxAge: 0 }));
  return redirect("/", { headers, status: 303 });
}
