---
title: Meetup invitations
type: feature
created: 2026-11-24
status: done
baseline_commit: d9093aba888f4bd378bd0e5d68ec6439fd0d613f
route: dispatch
review_loop_iteration: 0
context: [architecture.md, requirements/requirements.md]
---

<frozen-after-approval>

## Intent

Build Тусовка, the full-stack event and invitation app described in the committed requirements and architecture. A visitor can discover a gathering, create an account, reserve a seat and return through their profile. A host can manage the gathering and invite guests privately. Deliver a runnable repository with a Ukrainian liquid-glass interface.

## Boundaries and constraints

Use React Router Framework Mode, TypeScript, Node.js, Better Auth and a local SQLite database. Persist accounts, session grants, events, processed covers, comments and RSVPs. Keep private resources under the same visibility rule and mutations under server-side authorization.

## Scenarios

| Scenario | Result |
|---|---|
| Two users request the last place | Exactly one reservation succeeds |
| Guest has a valid private link | Sign-in and redemption lead to a clean event URL |
| An account cannot view the event | Details and cover are unavailable |
| A guest tries to edit | Host data remains intact |
| Duplicate RSVP or cancellation | Seat count stays consistent |

</frozen-after-approval>

## Code map

The existing architecture and requirements describe the complete product. Application code, dependency configuration, database and UI are new.

## Tasks and acceptance

- [x] Implement server, auth, SQLite migrations and durable invitations in app/server and migrations.
- [x] Implement discovery, detail, editor, authentication and profile in app/routes, with shared responsive CSS.
- [x] Add a reproducible startup, integration checks and README.
- Given a new checkout, when following the README, then the app loads and supports the host and guest flows.
- Given a private event, when a visitor requests its cover or details, then only a host, authorized session or confirmed guest sees it.
- Given concurrent requests for the last seat, when both transactions finish, then exactly one guest has booked it.

## Design notes

Discovery is a Ukrainian cultural events guide. Give the brand an original ticket-shaped mark. Use a full-width illustrated violet glass hero with a short Ukrainian editorial headline, then a searchable, responsive grid with rich full-bleed cover images above their metadata. Keep the top nav and content aligned, with strong typographic hierarchy. Provide an optional, idempotent local starter catalog of upcoming Ukrainian cultural events so a fresh development launch showcases the experience. The app uses a hero image at public/art/hero.webp and three bundled event covers at public/art/music.webp, ceramics.webp and cinema.webp for this catalog. The browser must also work in an empty production catalog.

## Implementation Notes

The production entry point initializes React and Express in production mode, trusts a loopback TLS proxy and serves the static client bundle. A two-account browser run exercised sign-up, private creation, invite return, reservation, commenting, profile access, cancellation and editing. The starter catalog is opt-in for production and is seeded once during local development.

## Spec Change Log

## Review Triage Log

- Medium — Private profile tests exercised only a positive booking result. Add negative checks for strangers and the host/attendee sections.
- Medium — Discovery lacked a nonmatching control event. Exercise title and category inclusion and exclusion.
- Medium — Rotation was tested independently of visibility changes. Test visibility edits and stale grants.
- Medium — Detail reads used separate statements. Keep the full authorized read in one SQLite snapshot.
- Medium — Cover visibility and content retrieval used separate reads. Share a snapshot.
- Low — A named zero-byte replacement was indistinguishable from an omitted upload. Reject named empty files.
- Low — An open page could advertise a seat after registration closed. Refresh deadline state.
- Low — Full and closed event subtitles claimed availability. Reflect the server state.
- Low — Unbroken user text could overflow narrow devices. Allow long strings to wrap.
- Low — Event dates lacked a displayed year. Show the year on dates.
- Medium — Booking rejection could preserve stale loader counts. Refresh the associated event state.
- Medium — Session lifetime could diverge between the database and the browser cookie. Use a seven-day fixed session.
- Medium — The shared authentication rate limit affected unrelated clients. Throttle by trusted client address and email.
- Medium — Discovery responses scaled with the entire catalog. Page public results and load only card fields.
- Medium — The event page included an unbounded comment history. Page comments while keeping the total visible.
- Medium — Comment throttling scanned unrelated rows under a write transaction. Index author and time.
- Medium — Mobile registration errors appeared far from the RSVP control. Keep each error with its action.
- Low — Static responses received the dynamic no-store header. Apply no-store after serving static assets.
- Low — Changes to the comment total could clear an unsent draft. Reset only after the writer successfully submits.
- Low — Profile and discovery could display the same date for different years. Include the year.

## Verification

Type checking, the production build and all four automated tests passed. Two browser sessions verified the host and invited guest journeys against the production server. Desktop and mobile discovery rendered without horizontal overflow.
