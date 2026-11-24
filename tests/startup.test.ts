import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { request } from "node:http";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { test } from "node:test";

test("the production entry point renders HTML and accepts a same-origin form behind a local TLS proxy", async t => {
  const directory = await mkdtemp(join(tmpdir(), "tusovka-production-"));
  const site = "https://gatherings.example.test";
  const child = spawn(process.execPath, ["scripts/serve.mjs"], {
    env: {
      ...process.env,
      NODE_ENV: "development", // Startup must set production before React and its renderer load.
      DATABASE_PATH: join(directory, "app.sqlite"),
      BETTER_AUTH_SECRET: randomBytes(32).toString("base64url"),
      BETTER_AUTH_URL: site,
      HOST: "127.0.0.1",
      PORT: "0",
    },
    stdio: ["ignore", "pipe", "inherit"],
  });
  const exited = once(child, "exit");
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited;
    await rm(directory, { recursive: true, force: true });
  });
  const lines = createInterface({ input: child.stdout });
  const [ready] = await Promise.race([
    once(lines, "line", { signal: AbortSignal.timeout(15_000) }),
    exited.then(([code]) => { throw new Error("Server exited during startup with code " + code); }),
  ]);
  const match = /listens on port (\d+)/.exec(ready);
  assert.ok(match, "server reports its listening address");
  const local = "http://127.0.0.1:" + match[1];
  const headers = { Host: new URL(site).host, "X-Forwarded-Proto": "https" };
  const page = await fetch(local, { headers });
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("Cache-Control"), "private, no-store");
  const html = await page.text();
  assert.match(html, /Найближчі події/);
  const stylesheet = /href="(\/assets\/[^"]+\.css)"/.exec(html);
  assert.ok(stylesheet);
  const asset = await fetch(local + stylesheet[1], { method: "HEAD" });
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get("Cache-Control") || "", /immutable/);
  // node:http preserves the Host header supplied by a reverse proxy.
  const registration = request(local + "/auth", {
    method: "POST", headers: { ...headers, Origin: site, "Content-Type": "application/x-www-form-urlencoded" },
  });
  const response = once(registration, "response");
  registration.end(new URLSearchParams({
    mode: "signup", name: "Guest", email: "guest@example.test",
    password: "temporary-test-password", next: "/profile",
  }).toString());
  const [result] = await response;
  result.resume();
  assert.equal(result.statusCode, 303);
  assert.equal(result.headers.location, "/profile");
  assert.match(result.headers["set-cookie"].join(" "), /; Secure/i);
});
