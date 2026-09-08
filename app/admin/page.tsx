import { redirect } from "next/navigation";
import { getSession } from "../../src/lib/auth";
import { isAdminEmail } from "../../src/lib/admin";
import { getIdentity } from "../../src/lib/hackclub";
import { listMessagesBySubmissionIds, listSubmissions, SUBMISSION_FIELDS } from "../../src/lib/airtable";
import AdminQueue, { type AdminSubmissionRow } from "../components/admin/AdminQueue";

const TELESCREEN_BASE = "https://telescreen.hackclub.com/workbench/hackatime/overview";
// https://telescreen.hackclub.com/workbench/hackatime/overview?u=3353&p=gofan-front
// Only the fields needed to render the queue are ever fetched from
// Airtable — Name/Email/Address/Birthday are never requested, so they can't
// leak into this page's payload even by accident.
const QUEUE_FIELDS = [
  SUBMISSION_FIELDS.hackatimeId,
  SUBMISSION_FIELDS.hackatimeProjects,
  SUBMISSION_FIELDS.overrideHours,
  SUBMISSION_FIELDS.description,
  SUBMISSION_FIELDS.codeUrl,
  SUBMISSION_FIELDS.playableUrl,
  SUBMISSION_FIELDS.lapseLinks,
  SUBMISSION_FIELDS.screenshot,
  SUBMISSION_FIELDS.approved,
  SUBMISSION_FIELDS.reviewStatus,
];

const DUPLICATE_CHECK_FIELDS = [
  SUBMISSION_FIELDS.codeUrl,
  SUBMISSION_FIELDS.approved,
  SUBMISSION_FIELDS.reviewStatus,
  SUBMISSION_FIELDS.overrideHours,
];

// Treats cosmetically different links to the same project as the same
// Code URL — admins paste these by hand and rarely agree on protocol/www.
function normalizeCodeUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function filterFormula(status: "Pending" | "Approved" | "Rejected" | "Fraud") {
  if (status === "Approved") return `{${SUBMISSION_FIELDS.approved}} = TRUE()`;
  if (status === "Pending") {
    return `AND({${SUBMISSION_FIELDS.approved}} = FALSE(), OR({${SUBMISSION_FIELDS.reviewStatus}} = 'Pending', {${SUBMISSION_FIELDS.reviewStatus}} = ''))`;
  }
  return `{${SUBMISSION_FIELDS.reviewStatus}} = '${status}'`;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session?.access_token) redirect("/api/auth/login");

  const identity = await getIdentity(session.access_token);
  if (!identity?.primary_email || !isAdminEmail(identity.primary_email)) {
    redirect("/");
  }

  const status = ((await searchParams).status as "Pending" | "Approved" | "Rejected" | "Fraud") ?? "Pending";
  const records = await listSubmissions(filterFormula(status), QUEUE_FIELDS);

  const messagesBySubmission = await listMessagesBySubmissionIds(records.map((r) => r.id));

  // Cross-status scan so a duplicate/already-approved Code URL is flagged
  // no matter which status tab it's being viewed from.
  const allRecords = await listSubmissions(undefined, DUPLICATE_CHECK_FIELDS);
  const groupsByCodeUrl = new Map<string, { id: string; approved: boolean }[]>();
  let unreviewedCount = 0;
  let totalHours = 0;
  for (const record of allRecords) {
    const codeUrl = String(record.fields[SUBMISSION_FIELDS.codeUrl] ?? "").trim();
    if (codeUrl) {
      const key = normalizeCodeUrl(codeUrl);
      const group = groupsByCodeUrl.get(key) ?? [];
      group.push({ id: record.id, approved: Boolean(record.fields[SUBMISSION_FIELDS.approved]) });
      groupsByCodeUrl.set(key, group);
    }

    const approved = Boolean(record.fields[SUBMISSION_FIELDS.approved]);
    const reviewStatus = String(record.fields[SUBMISSION_FIELDS.reviewStatus] ?? "Pending");
    if (!approved && (reviewStatus === "Pending" || reviewStatus === "")) unreviewedCount += 1;

    const hoursRaw = record.fields[SUBMISSION_FIELDS.overrideHours];
    if (typeof hoursRaw === "number") totalHours += hoursRaw;
  }
  const queueCount = allRecords.length;

  const rows: AdminSubmissionRow[] = records.map((record) => {
    const codeUrl = String(record.fields[SUBMISSION_FIELDS.codeUrl] ?? "").trim();
    const group = codeUrl ? groupsByCodeUrl.get(normalizeCodeUrl(codeUrl)) ?? [] : [];
    const others = group.filter((r) => r.id !== record.id);
    const duplicateRecordIds = others.map((r) => r.id);
    const duplicateHasApproved = others.some((r) => r.approved);
    return buildRow(record, duplicateRecordIds, duplicateHasApproved);
  });

  function buildRow(
    record: (typeof records)[number],
    duplicateRecordIds: string[],
    duplicateHasApproved: boolean,
  ): AdminSubmissionRow {
    const hackatimeId = String(record.fields[SUBMISSION_FIELDS.hackatimeId] ?? "");
    const screenshot = record.fields[SUBMISSION_FIELDS.screenshot] as
      | Array<{ url: string }>
      | undefined;
    const hoursRaw = record.fields[SUBMISSION_FIELDS.overrideHours];
    return {
      id: record.id,
      hackatimeId,
      telescreenLink: `${TELESCREEN_BASE}?u=${encodeURIComponent(hackatimeId)}`,
      codeUrl: String(record.fields[SUBMISSION_FIELDS.codeUrl] ?? ""),
      playableUrl: String(record.fields[SUBMISSION_FIELDS.playableUrl] ?? ""),
      lapseLinks: String(record.fields[SUBMISSION_FIELDS.lapseLinks] ?? ""),
      hackatimeProjects: String(record.fields[SUBMISSION_FIELDS.hackatimeProjects] ?? ""),
      description: String(record.fields[SUBMISSION_FIELDS.description] ?? ""),
      hours: typeof hoursRaw === "number" ? hoursRaw : 0,
      screenshotUrl: screenshot?.[0]?.url ?? null,
      approved: Boolean(record.fields[SUBMISSION_FIELDS.approved]),
      reviewStatus: String(record.fields[SUBMISSION_FIELDS.reviewStatus] ?? "Pending"),
      messages: messagesBySubmission.get(record.id) ?? [],
      duplicateRecordIds,
      duplicateHasApproved,
    };
  }

  return (
    <section className="w-4/6 mx-auto min-h-screen py-10 flex flex-col gap-6">
      <div className="flex items-baseline gap-4">
        <p className="text-4xl">review queue.</p>
        <a href="/admin/timer" className="link opacity-70">
          timer control →
        </a>
      </div>
      <div className="stats stats-vertical sm:stats-horizontal bg-base-200 shadow">
        <div className="stat">
          <div className="stat-title">Unreviewed</div>
          <div className="stat-value">{unreviewedCount}</div>
        </div>
        <div className="stat">
          <div className="stat-title">In queue</div>
          <div className="stat-value">{queueCount}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Total hours</div>
          <div className="stat-value">{Math.round(totalHours * 10) / 10}</div>
        </div>
      </div>
      <AdminQueue rows={rows} filter={status} />
    </section>
  );
}
