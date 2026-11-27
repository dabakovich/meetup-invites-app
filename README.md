# Тусовка

A Ukrainian-language event and invitation app built with React Router Framework Mode, Better Auth and SQLite. Hosts publish gatherings with covers and invite guests to private events. Guests can search the public catalog, reserve a seat, leave a comment and return to their events through their profile.

## Run locally

Use Node.js 22.18 or later and npm. From the repository root, run:

```sh
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173). Development runs the migrations on first use and seeds three upcoming cultural events once. Register your own account using **Увійти → Реєстрація**. The sample events belong to an editorial account with no login credentials.

To start with an empty catalog on a separate database, use `DATABASE_PATH=data/empty.sqlite SEED_CATALOG=0 npm run dev`. To populate a database explicitly, run `npm run seed`. Repeated seeding preserves edits, bookings and deletions. Uploaded covers, invitations, accounts and sessions survive restarts.

## Try the host and guest flows

1. Select **Створити**, register or sign in, add a future date in Kyiv time, upload a cover and save.
2. For a public event, open **Події** and search its title. For a private event, use **Скопіювати посилання-запрошення** on its detail page.
3. In another browser profile, open the invite, sign in as a different account, then select **Іду**. The browser returns to a clean event URL.
4. Visit **Профіль → Я йду** to reopen the event or cancel. The host can see the participant list, edit the event, replace its invite or confirm deletion.

## Production

Build once and set a stable origin and secret before starting. For a local production smoke test:

```sh
npm ci
npm run build
export BETTER_AUTH_URL=http://localhost:3000
export BETTER_AUTH_SECRET="$(openssl rand -hex 32)"
npm start
```

Open [localhost:3000](http://localhost:3000). Keep the same secret across restarts. For a deployed instance, use the public HTTPS origin and store the secret in deployment configuration. A local `.env` file is also supported by the startup scripts.

| Setting | Purpose |
| --- | --- |
| `BETTER_AUTH_URL` | Public origin. Required for production. Development defaults to `http://localhost:5173`. |
| `BETTER_AUTH_SECRET` | Secret of at least 32 characters. Required for production. Development generates and persists a local secret in SQLite. |
| `DATABASE_PATH` | SQLite file, default `data/tusovka.sqlite`. Use a persistent local disk. |
| `PRIVACY_CONTROLLER`, `PRIVACY_CONTACT` | The data controller’s name and contact information for the registration privacy notice. Set both for a public deployment. |
| `PORT`, `HOST` | Production listener, default `127.0.0.1:3000`. |
| `SEED_CATALOG` | Set to `0` to skip the optional starter catalog. Production starts without seeding. |

Run one Node instance behind a TLS-terminating reverse proxy on the same host. Preserve the public Host header and have the proxy overwrite X-Forwarded-For, X-Forwarded-Host and X-Forwarded-Proto with values derived from the connection. Omit invite URLs from access logs. HTTPS enables Secure cookies. The application uses HttpOnly session cookies, same-origin mutation checks, seven-day sessions, persistent per-client and per-email sign-in throttling, and per-account comment limits.

SQLite uses WAL, foreign keys and a busy timeout. Back up using SQLite’s online backup API or the CLI `.backup` command. Keep the database, backups and auth secret private. Uploaded JPEG, PNG and WebP images are limited to 5 MiB and 24 megapixels, decoded and re-encoded as WebP before storage. The cover endpoint applies the same visibility check as the event page.

### Deploy with Docker Compose

Use a Linux host with Docker Engine and the Docker Compose plugin. Set `BETTER_AUTH_URL` to your public HTTPS origin and `BETTER_AUTH_SECRET` to a stable secret generated with `openssl rand -hex 32`. Set `PRIVACY_CONTROLLER` and `PRIVACY_CONTACT` for a public deployment. Put these values in a private `.env` file.

The VPS runs one system Caddy service for all sites. Its route for `meetups.tada.wtf` forwards to `127.0.0.1:3001`. The app shares the Linux host network and listens only on loopback, which Express trusts for proxy headers. Compose sets port 3001 even if an older server `.env` still contains `APP_PORT=3100`. Set `BETTER_AUTH_URL=https://meetups.tada.wtf` and retain the existing auth secret.

For a manual deployment from a **full checkout**, run `docker compose up --detach --build --wait`. To check the local route on the VPS, run `curl -fsS -o /dev/null http://127.0.0.1:3001/`. The Actions deployment directory only needs its persistent `.env` because the workflow builds from a temporary source directory.

The [shared Caddy configuration](https://github.com/dabakovich/gender-party-invites/blob/release/deploy/Caddyfile) and [two-site cutover procedure](https://github.com/dabakovich/gender-party-invites/blob/release/deploy/VPS.md) live in the gender-party repository. The `meetup-invites_data` Docker volume persists the SQLite database between deployments.

### Deploy with GitHub Actions

The included workflow deploys pushes to `production` over SSH, waits for the app health check, and checks the public origin through Caddy. Install `curl` on the VPS. Add these secrets to the `production` GitHub environment or to the repository’s Actions secrets. Create the private `.env` on the deployment host at `VPS_PATH/.env` before the first push.

| Secret | Value |
| --- | --- |
| `VPS_HOST` | Public IP or DNS name of the SSH server. |
| `VPS_USER` | SSH account with write access to `VPS_PATH` and permission to run Docker. |
| `VPS_PORT` | SSH port. The workflow defaults to `22`. |
| `VPS_PATH` | Absolute path to the deployment directory on the host. |
| `VPS_KNOWN_HOSTS` | Verified OpenSSH `known_hosts` entry for `VPS_HOST`. Use `[host]:port` for a non-default port. |
| `VPS_SSH_KEY` | Private key for the deployment account, with the public key installed in its `authorized_keys`. |

## Verification

```sh
npm run typecheck
npm test
```

The test command builds the production bundles, then runs integration tests against temporary databases. The checks cover private event and cover access, invite redemption across sign-in, host-only management, origin validation, comments, idempotent RSVP/cancellation, image validation two separate SQLite connections racing for the final seat, and production startup behind a local reverse proxy.

## Code

- `app/routes/` contains the five screens, invite redemption, protected cover delivery and logout.
- `app/server/` handles authentication, visibility, uploads, rate limits and transactional seat allocation.
- `migrations/` contains versioned SQL. Event covers and invitation grants live in the same database as events.
- `scripts/` contains the production server and optional starter catalog.
