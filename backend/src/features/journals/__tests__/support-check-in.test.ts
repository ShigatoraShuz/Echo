import { expect, it, vi } from "vitest";
import { JournalService } from "../journals.service.js";

const headers = (count = 3) =>
  Array.from({ length: count }, (_, n) => ({
    id: `journal-${n}`,
    analysis_consent: true,
  }));
function setup(
  journals = headers(),
  statuses = [
    "safety_action_required",
    "safety_action_required",
    "safety_action_required",
  ],
  jobRows?: Array<{ journal_id: string; status: string }>,
) {
  const filters: unknown[] = [];
  let failed = false;
  const query = (table: string) => {
    const q = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((...args) => {
        filters.push([table, ...args]);
        return q;
      }),
      is: vi.fn((...args) => {
        filters.push([table, ...args]);
        return q;
      }),
      order: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      limit: vi.fn(async () => ({
        error: failed ? { message: "fixture failure" } : null,
        data:
          table === "journals"
            ? journals
            : (jobRows ??
              statuses.map((status, n) => ({
                journal_id: `journal-${n}`,
                status,
              }))),
      })),
    };
    return q;
  };
  const service = Object.assign(Object.create(JournalService.prototype), {
    database: { schema: () => ({ from: query }) },
    userDatabase: () => ({ schema: () => ({ from: query }) }),
  }) as JournalService;
  return {
    service,
    filters,
    fail: () => {
      failed = true;
    },
  };
}
it("offers only for three distinct owned saved journals with active backend flags", async () => {
  const { service, filters } = setup();
  expect(await service.supportCheckIn("owner")).toEqual({
    ownerId: "owner",
    recentJournalIds: ["journal-0", "journal-1", "journal-2"],
    eligible: true,
  });
  expect(filters).toContainEqual(["journals", "user_id", "owner"]);
  expect(filters).toContainEqual(["analysis_requests", "user_id", "owner"]);
  expect(filters).toContainEqual(["journals", "deleted_at", null]);
  expect(filters).toContainEqual(["analysis_requests", "deleted_at", null]);
});
it.each(["completed", "queued", "failed", "safety_checking"])(
  "breaks the run for a %s journal",
  async (status) => {
    const { service } = setup(headers(), [
      "safety_action_required",
      status,
      "safety_action_required",
    ]);
    expect((await service.supportCheckIn("owner")).eligible).toBe(false);
  },
);
it("does not count fewer than three journals, duplicate retries, missing analysis, or nonconsented entries", async () => {
  expect(
    (await setup(headers(2)).service.supportCheckIn("owner")).eligible,
  ).toBe(false);
  const nonconsented = headers();
  nonconsented[1].analysis_consent = false;
  expect(
    (await setup(nonconsented).service.supportCheckIn("owner")).eligible,
  ).toBe(false);
  expect(
    (
      await setup(headers(), ["safety_action_required"]).service.supportCheckIn(
        "owner",
      )
    ).eligible,
  ).toBe(false);
});
it("does not convert a database error into an escalation", async () => {
  const { service, fail } = setup();
  fail();
  await expect(service.supportCheckIn("owner")).rejects.toThrow(
    "Support check-in could not be checked",
  );
});

it("does not count repeated jobs for one journal and honors the latest status", async () => {
  const duplicates = Array.from({ length: 3 }, () => ({
    journal_id: "journal-0",
    status: "safety_action_required",
  }));
  expect(
    (await setup(headers(), [], duplicates).service.supportCheckIn("owner"))
      .eligible,
  ).toBe(false);
  const rows = [
    { journal_id: "journal-0", status: "completed" },
    ...duplicates,
    { journal_id: "journal-1", status: "safety_action_required" },
    { journal_id: "journal-2", status: "safety_action_required" },
  ];
  expect(
    (await setup(headers(), [], rows).service.supportCheckIn("owner")).eligible,
  ).toBe(false);
});
