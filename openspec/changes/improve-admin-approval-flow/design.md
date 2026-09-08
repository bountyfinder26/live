## Context

`app/api/admin/review/route.ts` already has a generic `if (message) createMessage(...)` path that fires for any action — the restriction to rejection-only messages lives entirely in `AdminQueue.tsx`'s `act()` helper, which hardcodes `message: action === "reject" ? rejectDraft[id] : undefined`. Similarly, hours are written via a separate `"hours"` action distinct from `"approve"`, requiring two round-trips today.

The Airtable base already has an `Optional - Override Hours Spent Justification` field on the `YSWS Project Submission` table (confirmed via the Airtable meta API) that is not present in `SUBMISSION_FIELDS` and is not read/written anywhere in the codebase. No schema change is needed to use it.

The admin queue (`app/admin/page.tsx`) currently fetches only the records matching the selected status filter (`Pending`/`Approved`/`Rejected`/`Fraud`), so there is no way today to detect that a Code URL visible in one tab is also present (and possibly already `Approved`) in another.

## Goals / Non-Goals

**Goals:**
- Let an admin send an optional message to the submitter as part of approving a project.
- Let an admin set final hours and a justification for any override in the same approve action.
- Surface, per submission row, whether its Code URL collides with another submission — including one that's already `Approved` — regardless of which status tab is open.

**Non-Goals:**
- No new Airtable fields or schema changes.
- No persisted/stored duplicate flag or Review Status value for duplicates — it is purely a live, computed UI signal.
- No change to how Fraud or Reject messaging works today (Reject already requires and sends a message).
- No change to who is authorized to review (`isAdminEmail` gate is untouched).
- No blocking of the Approve action when a duplicate is detected — it's a warning, not a hard stop (open question below if this needs revisiting).

## Decisions

**Fuse "hours" into "approve" rather than keeping both actions.**
Today's flow requires "Save hours" then "Approve" as two separate requests. Since hours + justification only matter at the moment of approval (per the user's framing — "when I approve a project"), the approve request will carry `hours`, `justification`, and `message` together. The standalone `"hours"` action in the API can remain (it's harmless and other flows might still deflate hours without approving), but the UI's primary path folds it into Approve.
- Alternative considered: keep them as two separate calls but auto-chain the requests client-side. Rejected — an admin could refresh between them and only the hours would save, no benefit over combining server-side.

**Map `overrideHoursJustification` to the existing Airtable field, no new field.**
`Optional - Override Hours Spent Justification` already exists, is unused, and its plain-English name is a coincidental match to "override" (confirmed with the user — it is not tied to any override/duplicate-approval semantics). Add it to `SUBMISSION_FIELDS` as `overrideHoursJustification` and write it whenever hours are set on approve.
- This field is never included in `QUEUE_FIELDS`-adjacent submitter-facing reads/writes (`app/components/dashboard/SubmissionForm.tsx` has no reference to it today), keeping it admin-only by construction — no explicit access-control mechanism needed since the submitter form never touches Airtable field names it doesn't declare.

**Duplicate detection: live scan, normalized Code URL, per-row badges, computed in `app/admin/page.tsx`.**
On every admin page load, regardless of the active status filter, fetch a lightweight cross-status list of `{id, codeUrl, approved}` for all submissions (a second `listSubmissions` call with a formula matching all records, requesting only those 2-3 fields to keep payload small). Normalize each Code URL (strip `http://`/`https://`, strip leading `www.`, trim, lowercase, strip trailing slash) and group by the normalized value. Any group with more than one member is a duplicate set; pass a per-row annotation (e.g. `duplicateOf: string[]` record ids, `duplicateHasApproved: boolean`) into `AdminQueue` so each row in the set — not just one — renders a badge.
- Alternative considered: only flag when opening the Pending tab against the full table. Rejected — the ask is "per project instance," meaning every row that participates in a collision should show it, in whatever tab it's being viewed from.
- Alternative considered: server-side filterByFormula duplicate detection in Airtable. Rejected — Airtable formulas can't easily do cross-record grouping; simpler and cheaper to fetch a thin field set and group in-memory.

**Message on approve reuses the existing `createMessage` path unmodified.**
Only `AdminQueue.tsx`'s `act()` needs to stop hardcoding `undefined` for non-reject actions, and gain an input for the approve message. No API changes needed for this part beyond making sure `hours`/`justification` also travel in the same request body as `extra`.

## Risks / Trade-offs

- **[Risk]** Normalizing Code URLs too aggressively could conflate two genuinely different projects that happen to share a stripped-down URL (unlikely for Code URLs, but possible for shortened/redirect URLs). → Mitigation: normalization is narrow (protocol, `www.`, trailing slash, case, whitespace) — not fuzzy matching — so it only merges what a human would consider "the same link."
- **[Risk]** Fetching all submissions on every admin page load adds a second Airtable request. → Mitigation: request only 3 thin fields (`Code URL`, `Approved`, record id is free), keeping payload small; Airtable's per-page limits are generous relative to expected submission volume.
- **[Trade-off]** Duplicate flag is a warning only, not a hard block — an admin can still approve a flagged duplicate. This matches "flag it" from the request rather than "prevent it," but is worth confirming doesn't need to escalate to a hard stop later.

## Migration Plan

No data migration. Deploy is a single code change:
1. Add `overrideHoursJustification` to `SUBMISSION_FIELDS`.
2. Update `POST /api/admin/review` to accept `hours`/`justification`/`message` on the `"approve"` action.
3. Update `app/admin/page.tsx` to fetch the cross-status Code URL list and compute duplicate annotations.
4. Update `AdminQueue.tsx` to add the approve-message input, fold hours+justification into Approve, and render duplicate badges.

Rollback is a plain revert — no Airtable state is created or migrated by this change.

## Open Questions

- Should a flagged duplicate ever hard-block Approve, or stay a warning indefinitely?
