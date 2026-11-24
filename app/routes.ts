import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/discover.tsx"),
  route("auth", "routes/auth.tsx"),
  route("logout", "routes/logout.ts"),
  route("profile", "routes/profile.tsx"),
  route("events/new", "routes/editor.tsx", { id: "event-new" }),
  route("events/:id/edit", "routes/editor.tsx", { id: "event-edit" }),
  route("events/:id", "routes/event.tsx"),
  route("events/:id/cover", "routes/cover.ts"),
  route("invite/:token", "routes/invite.ts"),
] satisfies RouteConfig;
