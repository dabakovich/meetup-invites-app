---
title: Production signup behind a reverse proxy
type: bugfix
created: 2026-11-24
status: in-progress
route: oneshot
review_loop_iteration: 0
context: []
---

<frozen-after-approval>

## Intent

Allow users to register through the public HTTPS website when the hosting proxy forwards requests over HTTP. Preserve origin validation and secure session cookies.

</frozen-after-approval>

## Implementation Notes

React Router rejects the proxied submission before the signup handler runs. Configure its runtime action origin from the deployed public URL. Use a same-origin referrer policy on form pages so native browser submissions can include their origin. Exercise registration with an internal Host header against the production entry point.
