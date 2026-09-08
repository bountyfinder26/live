## Why

Admins reviewing project submissions currently have no way to send the submitter a message on approval (only rejection sends one), and can't record why they overrode a project's hours at the moment they approve it — instead they must save hours as a separate step with no justification. Admins also have no visibility into whether a submission's Code URL has already been approved elsewhere, or whether two pending submissions are duplicates of each other, which risks double-paying the same project.

## What Changes

- Add an optional message input to the Approve action in the admin review queue, sent through the existing `Submission Messages` table (already sender-agnostic in the API — only the UI currently restricts messages to rejection).
- Fuse the existing standalone "hours" action into the approve action: when a reviewer approves, they can set the final hours and write a justification for any override, in one request.
- Map the existing (previously unused) Airtable field `Optional - Override Hours Spent Justification` into the app's field constants and write it on approve. This field is admin-only — it is never read or written by the submitter-facing submission form.
- Add a duplicate/already-approved indicator to each row in the admin review queue: on page load, scan all submissions' Code URLs (regardless of status filter) and badge every row instance whose normalized Code URL collides with another record — including cases where that other record is already Approved. Matching normalizes the URL (strip protocol, strip `www.`, trim, lowercase, strip trailing slash) so cosmetic differences in pasted links don't hide real duplicates.
- The duplicate indicator is computed at request time only — nothing is written to Airtable, and it is not shown anywhere outside the admin dashboard.

## Capabilities

### New Capabilities
- `admin-project-review`: Reviewer-facing capabilities for approving/rejecting project submissions — sending messages on any verdict, recording an hours override with justification, and detecting duplicate/already-approved submissions by Code URL.

### Modified Capabilities
(none — no existing spec covers admin review today)

## Impact

- `app/api/admin/review/route.ts`: approve action accepts and forwards an optional message, accepts hours + justification, writes `SUBMISSION_FIELDS.overrideHoursJustification`; the standalone "hours"-only action may be retired in favor of the fused approve flow.
- `app/components/admin/AdminQueue.tsx`: UI changes — message input on Approve, hours + justification inputs folded into the Approve action, duplicate/already-approved badge per row.
- `app/admin/page.tsx`: fetch all submissions' `{id, codeUrl, approved}` (not just the current status filter) to build the duplicate lookup passed to `AdminQueue`.
- `src/lib/airtable.ts`: add `overrideHoursJustification: "Optional - Override Hours Spent Justification"` to `SUBMISSION_FIELDS`.
- No Airtable schema changes required — the justification field already exists and is currently unused by any code path.
