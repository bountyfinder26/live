## ADDED Requirements

### Requirement: Admin can message the submitter on approval
An admin reviewing a project submission SHALL be able to send an optional message to the submitter as part of approving the submission, using the same messaging mechanism already used for rejection messages (the `Submission Messages` table).

#### Scenario: Approve with a message
- **WHEN** an admin approves a submission and provides a message
- **THEN** the submission is marked Approved and a message record is created linking to that submission, attributed to the admin sender

#### Scenario: Approve without a message
- **WHEN** an admin approves a submission and leaves the message blank
- **THEN** the submission is marked Approved and no message record is created

### Requirement: Admin can set hours and justification at approval time
An admin SHALL be able to set the final override hours and a justification for that override in the same action used to approve a submission, without requiring a separate prior request.

#### Scenario: Approve with hours override and justification
- **WHEN** an admin approves a submission with an hours value and a justification string
- **THEN** the submission's override hours field is set to the provided value, its justification field is set to the provided string, and the submission is marked Approved

#### Scenario: Justification field is admin-only
- **WHEN** a submitter fills out or edits their own project submission
- **THEN** the submitter-facing form never reads or writes the hours override justification field

### Requirement: Admin queue flags duplicate or already-approved Code URLs
The admin review queue SHALL indicate, for each submission row, when that submission's Code URL matches another submission's Code URL — regardless of the status tab currently being viewed — including the case where the matching submission is already Approved.

#### Scenario: Two pending submissions share a Code URL
- **WHEN** two submissions in any status have Code URLs that are equal after normalization
- **THEN** each of those submissions' rows in the admin queue displays a duplicate indicator identifying the other record(s) it collides with

#### Scenario: A submission's Code URL matches an already-approved submission
- **WHEN** a submission's Code URL, after normalization, matches the Code URL of a different submission that is Approved
- **THEN** the submission's row in the admin queue displays an indicator that this Code URL has already been approved

#### Scenario: Code URL normalization ignores cosmetic differences
- **WHEN** comparing two Code URLs that differ only by protocol (`http` vs `https`), presence of a leading `www.`, trailing slash, letter case, or surrounding whitespace
- **THEN** the two Code URLs are treated as matching for duplicate-detection purposes

#### Scenario: Duplicate flag is not persisted
- **WHEN** the admin queue computes duplicate indicators on page load
- **THEN** no data is written to Airtable as a result, and the indicator is not visible anywhere outside the admin dashboard

#### Scenario: Approving a flagged duplicate is still allowed
- **WHEN** an admin approves a submission whose row shows a duplicate or already-approved indicator
- **THEN** the approval proceeds normally; the indicator does not block the action
