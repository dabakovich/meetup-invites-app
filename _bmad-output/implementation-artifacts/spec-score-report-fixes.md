---
title: 'Address score report findings'
type: 'bugfix'
created: '2026-11-24'
status: 'done'
route: 'dispatch'
baseline_commit: '7ab3ddb41f3bedf138d1c9dfab3744b37ed94be8'
context: []
---

<frozen-after-approval reason="user request">

## Intent

Address the report's privacy, account management, event date, moderation, duplicate submission, and mobile navigation findings while preserving existing security and reliability.

## Boundaries & Constraints

Do not invent the operator's identity or contact details. Enforce authorization and validation on the server. Preserve existing user data through migrations.

</frozen-after-approval>

## Code Map

- `app/routes/auth.tsx`, `app/routes/profile.tsx`, `app/server/auth.server.ts`: account and registration flows.
- `app/routes/event.tsx`, `app/server/events.server.ts`: event and comment operations.
- `app/routes/editor.tsx`, `app/model.ts`: event form and Kyiv date handling.
- `app/root.tsx`, `app/style.css`: navigation and footer.
- `migrations/`, `app/server/db.server.ts`: SQLite schema and migrations.
- `tests/integration.test.ts`: existing end-to-end server integration tests.

## Tasks & Acceptance

- [x] Implement a privacy notice and account name editing and deletion with comment anonymization.
- [x] Restrict future dates to two years on server and form.
- [x] Add rules, reporting, and authorized comment removal.
- [x] Prevent duplicate event and comment submissions using persistent idempotency keys.
- [x] Make navigation readable on narrow screens.
- [x] Verify builds, tests, and relevant edge cases.

## Implementation Notes

Privacy controller and contact must be configured by the operator. Browser forms use idempotency keys; keyless clients remain supported.

## Spec Change Log

## Review Triage Log

Fixed report queue bounds, comment throttle bypass, reused comment IDs, existing distant event edits, report page context, route coverage and date boundary tests. Idempotent replays retain their original result after deletion; reporting is directed to event hosts. Independent escalation requires operator contact.

## Verification

`npm run typecheck` passed; `npm test` passed all 14 tests including production startup.
