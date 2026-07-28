import request from "supertest";
import app from "../../index";
import { describe, it, expect } from "@jest/globals";

describe("Grounding API", () => {
  it("returns 401 without auth token on sessions", async () => {
    const res = await request(app).post("/api/v1/grounding/sessions");
    expect(res.status).toBe(401);
  });
  it("returns 401 without auth token on history", async () => {
    const res = await request(app).get("/api/v1/grounding/history");
    expect(res.status).toBe(401);
  });
});
