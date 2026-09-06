import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { gatewayUserHeaders } from "@echo/service-core";
import { AssessmentService, phq8 } from "./assessment.js";
import { createAssessmentApp } from "./app.js";
const owner = "00000000-0000-4000-8000-000000000001",
  secret = "s".repeat(32);
function database(rows: unknown[] = []) {
  const query: any = {};
  for (const method of ["select", "eq", "order", "limit"]) query[method] = vi.fn(() => query);
  query.then = (resolve: any) => Promise.resolve(resolve({ data: rows, error: null }));
  query.insert = vi.fn((input: any) => {
    rows.unshift({ id: "assessment", completed_at: "2026-09-06T00:00:00Z", ...input });
    return query;
  });
  query.single = vi.fn(async () => ({ data: rows[0], error: null }));
  return { db: { from: vi.fn(() => query) }, query };
}
describe("Persistent PHQ-8", () => {
  it("is due on first login", async () => {
    const { db } = database();
    expect(await new AssessmentService(db as any, Buffer.alloc(32), 1).status(owner)).toMatchObject({
      due: true,
      lastCompletedAt: null,
      nextDueAt: null,
      intervalDays: 7,
    });
  });
  it.each([3, 7])("schedules the next assessment after %s days", async (days) => {
    const { db, query } = database([{ completed_at: "2026-09-01T00:00:00Z" }]);
    const service = new AssessmentService(db as any, Buffer.alloc(32), 1, days);
    expect((await service.status(owner, new Date("2026-09-02"))).due).toBe(false);
    expect((await service.status(owner, new Date(Date.parse("2026-09-01") + days * 86400000))).due).toBe(true);
    expect(query.eq).toHaveBeenCalledWith("user_id", owner);
  });
  it("saves only the authenticated user and returns the persisted timestamp", async () => {
    const { db, query } = database();
    const service = new AssessmentService(db as any, Buffer.alloc(32), 1);
    const result = await service.submit(owner, Array(8).fill(2));
    expect(result).toMatchObject({
      id: "assessment",
      score: 16,
      severity: "moderately_severe",
      completed_at: "2026-09-06T00:00:00Z",
    });
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: owner, answers: Array(8).fill(2) }));
    expect((await service.status(owner, new Date("2026-09-07"))).due).toBe(false);
  });
  it.each([[], Array(7).fill(1), Array(8).fill(4), Array(8).fill(-1), Array(8).fill(1.5), Array(8).fill(NaN)])(
    "rejects invalid answer values",
    (answers) => expect(() => phq8(answers)).toThrow(),
  );
  it("never reports a successful save when persistence fails", async () => {
    const { db, query } = database();
    query.single.mockResolvedValue({ data: null, error: { message: "offline" } });
    await expect(
      new AssessmentService(db as any, Buffer.alloc(32), 1).submit(owner, Array(8).fill(1)),
    ).rejects.toMatchObject({ code: "DATABASE_UNAVAILABLE" });
  });
  it("rejects unsigned status and history requests", async () => {
    const app = createAssessmentApp({} as any, secret);
    for (const route of ["status", "history"])
      expect((await request(app).get("/api/v1/assessments/phq8/" + route)).status).toBe(401);
  });
  it("validates API answers and ignores supplied user IDs", async () => {
    const service = { submit: vi.fn(async () => ({ id: "saved" })) };
    const app = createAssessmentApp(service as any, secret);
    const headers = gatewayUserHeaders({ userId: owner, requestId: "00000000-0000-4000-8000-000000000002", secret });
    expect(
      (
        await request(app)
          .post("/api/v1/assessments/phq8")
          .set(headers)
          .send({ answers: [1] })
      ).status,
    ).toBe(400);
    expect(service.submit).not.toHaveBeenCalled();
    expect(
      (
        await request(app)
          .post("/api/v1/assessments/phq8")
          .set(headers)
          .send({ answers: Array(8).fill(0), userId: "attacker" })
      ).status,
    ).toBe(201);
    expect(service.submit).toHaveBeenCalledWith(owner, Array(8).fill(0));
  });
});
