process.env.NODE_ENV = "production";
const { default: express } = await import("express");
const { createRequestHandler } = await import("@react-router/express");
const build = await import("../build/server/index.js");
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", "loopback");
app.use((request, response, next) => {
  request.headers["x-tusovka-client-address"] = request.ip || request.socket.remoteAddress;
  response.set({
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  });
  next();
});
app.use("/assets", express.static("build/client/assets", { immutable: true, maxAge: "1y" }));
app.use(express.static("build/client", { index: false }));
app.use((_request, response, next) => {
  response.set("Cache-Control", "private, no-store");
  next();
});
app.use(createRequestHandler({ build, mode: "production" }));
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, process.env.HOST || "127.0.0.1", error => {
  if (error) {
    console.error("Unable to start Тусовка:", error.message);
    process.exitCode = 1;
    return;
  }
  console.log(`Тусовка listens on port ${server.address().port}`);
});
