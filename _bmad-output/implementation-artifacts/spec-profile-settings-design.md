---
title: 'Profile settings design'
type: 'bugfix'
created: '2026-11-25'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Profile settings do not match the application's design and the confirmation checkbox is oversized.

**Approach:** Align the settings layout, controls, and destructive action with existing styles while preserving behavior and checking the local app.

</frozen-after-approval>

## Implementation Notes

- Styled the settings panel and destructive action; excluded checkboxes from full-width text input rules. Typecheck passed and the development server returned HTTP 200.

## Review Triage Log

- Medium: checkbox inherited full-width input styling; fixed by excluding checkboxes.
- Low: destructive button lacked hover feedback; added a darker hover state.
