import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import { resolve } from "node:path";

const database = resolve(process.env.DATABASE_PATH || "data/tusovka.sqlite");

export default defineConfig({
  plugins: [reactRouter()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    fs: {
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/data/**", database, database + "-*"],
    },
  },
});
