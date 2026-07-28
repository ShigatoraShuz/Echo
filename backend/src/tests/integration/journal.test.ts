import request from "supertest";
import app from "../../index";
import { describe, it, expect } from "@jest/globals";

describe("GET /api/v1/journal", () => {
  it("returns 401 without auth token", async () => {
    const res = await request(app).get("/api/v1/journal");
    expect(res.status).toBe(401);
  });
});
