
## Features
1. Accounts. Registration, login, logout
2. Create events with image
3. Main page
4. Event page
5. Event and guests managing by author


## What matters
- Security. The app will be attacking by hackers
- Quality
- Reliability

## Proposed app layout

Build **Тусовка** around five screens, with one event page for guests and hosts and one form for creating and editing. For the 20–30 minute build window, use a single server-rendered app with a relational database and built-in email/password authentication. The [technical brief](tech_requirements.pdf) gives security the largest share of the score, so get private access and seat limits working before polishing the glass effects.

| Screen | What it shows |
|---|---|
| **Події** | The home page opens directly to upcoming public events, soonest first. A title search sits above a cover-image grid. Each card shows the event title, date and time, and seats left. Use one column on phones and up to three on desktop. |
| **Подія** | Cover, title, date and time, description, remaining seats, and comments. Keep **Іду** or **Скасувати участь** beside the seat count, with the action pinned near the bottom on mobile. Hosts get **Редагувати**, a participant list, and a clearly separated delete action with confirmation. |
| **Створити / Редагувати подію** | One form with title, description, date and time with a visible time zone, capacity, cover upload and preview, and **Публічна / Приватна** visibility. After saving a private event, show **Скопіювати посилання-запрошення** on the event page. |
| **Вхід / Реєстрація** | One compact layout for both email/password forms. After sign-in, return people to the event or action that prompted it. |
| **Мій профіль** | Two sections, **Створені мною** and **Я йду**, with links back to each event. Put **Вийти** here and in the desktop account menu. |

Use **Події**, **Створити**, and **Профіль** as the signed-in navigation. For the liquid-glass look, use a pale blue-gray background, a frosted header and RSVP bar, thin highlights, and a single indigo accent. Keep forms, comments, and text below cover images on near-opaque surfaces so contrast stays consistent. Give **Місць немає**, invalid invitations, and empty search results clear text states.

## Security-sensitive flows

- **Private invite.** Require sign-in before revealing private event details. A valid invite opens the event, and a successful RSVP lets that account return through **Я йду**. Treat that return access as an explicit product decision. Keep private events out of discovery and search, and apply the same server-side access check to the cover and comments. Use unguessable invite tokens, exchange them for server-side access, then redirect to a clean URL. Show the same unavailable state for invalid links and inaccessible events. [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- **RSVP and cancellation.** Enforce one RSVP per account and event in the database, and allocate seats in a transaction. If two people try for the last seat, one succeeds and the other sees **Місць немає**. Reject capacity edits below the number already booked. Cancellation releases the seat, and the UI updates from the server response.
- **Host actions, comments, and uploads.** Check ownership on the server for edits, deletion, participant lists, and invite management. Use secure session cookies and CSRF protection for writes, rate-limit sign-in and comment posting, and render comments as plain text. Accept only bounded JPEG, PNG, or WebP uploads and decode and re-encode them server-side. [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

## Build order and submission

Build **sign-in → create a public event → discover and RSVP** as the first end-to-end slice. Then add private invites, host controls, comments, and the profile. Before submission, run one-command tests for cross-account access, private cover access, and two simultaneous RSVPs for the final seat. Submit a readable repository with a README that gives the exact startup commands and required environment variables.
