## 1. Airtable field mapping

- [x] 1.1 Add `overrideHoursJustification: "Optional - Override Hours Spent Justification"` to `SUBMISSION_FIELDS` in `src/lib/airtable.ts`

## 2. Approve action: message + hours + justification

- [x] 2.1 In `app/api/admin/review/route.ts`, extend the `"approve"` action to accept optional `hours` and `justification` from the request body, validating `hours` the same way the existing `"hours"` action does (finite, >= 0)
- [x] 2.2 When `hours` is provided on approve, write `SUBMISSION_FIELDS.overrideHours` and `SUBMISSION_FIELDS.overrideHoursJustification` alongside `SUBMISSION_FIELDS.approved`, `reviewedAt`, `reviewedBy` in the same `updateAirtableRecord` call
- [x] 2.3 Confirm the existing `if (message) createMessage(...)` path fires correctly when `action === "approve"` (no code change expected here — just verify the guard isn't action-scoped)

## 3. Admin queue: duplicate/already-approved detection

- [x] 3.1 In `app/admin/page.tsx`, add a second `listSubmissions` call (or extend the existing one) that fetches `{id, Code URL, Approved}` for all submissions regardless of status filter
- [x] 3.2 Write a Code URL normalization helper (strip `http://`/`https://`, strip leading `www.`, trim, lowercase, strip trailing slash)
- [x] 3.3 Group normalized Code URLs across all fetched records; for any group with more than one member, compute per-record annotations: `duplicateRecordIds: string[]` (other records sharing this URL) and `duplicateHasApproved: boolean`
- [x] 3.4 Pass these annotations into `AdminSubmissionRow` for rows in the current status view

## 4. Admin queue UI

- [x] 4.1 In `app/components/admin/AdminQueue.tsx`, add a message input for the Approve action (separate draft state from `rejectDraft`, e.g. `approveMessageDraft`)
- [x] 4.2 Fold the hours + justification inputs into the Approve action: extend the existing hours input row with a justification text input, and have the Approve button send `{hours, justification, message}` together instead of requiring a separate "Save hours" click first
- [x] 4.3 Keep or remove the standalone "Save hours" button per current call — if kept, leave the `"hours"`-only API action as a fallback path for adjusting hours without approving
- [x] 4.4 Render a duplicate/already-approved badge on any row with `duplicateRecordIds.length > 0`, distinguishing "duplicate of a pending/rejected record" vs "already approved elsewhere" in the badge text
- [x] 4.5 Ensure the duplicate badge and its computation are only ever rendered inside the admin queue component (no leakage into submitter-facing components)

## 5. Verification

- [ ] 5.1 Manually verify: approving with a message creates a `Submission Messages` record and the submitter sees it on their dashboard's message thread
- [ ] 5.2 Manually verify: approving with hours + justification writes both fields to the correct Airtable record
- [ ] 5.3 Manually verify: two submissions with cosmetically different but equivalent Code URLs (e.g. `http://github.com/x/y` vs `https://www.github.com/x/y/`) both show the duplicate badge
- [ ] 5.4 Manually verify: a pending submission whose Code URL matches an already-Approved submission shows the "already approved" variant of the badge
- [ ] 5.5 Manually verify: approving a flagged duplicate is not blocked
