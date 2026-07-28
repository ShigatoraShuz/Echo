import request from "supertest";
import app from "../../index";
import { describe, it, expect } from "@jest/globals";

describe("Settings API", () => {
  it("returns 401 without auth token on profile", async () => {
    const res = await request(app).get("/api/v1/settings/profile");
    expect(res.status).toBe(401);
  });
  it("returns 401 without auth token on notifications", async () => {
    const res = await request(app).get("/api/v1/settings/notifications");
    expect(res.status).toBe(401);
  });
  it("returns 401 without auth token on trusted contacts", async () => {
    const res = await request(app).get("/api/v1/settings/trusted-contacts");
    expect(res.status).toBe(401);
  });
  it("returns 401 without auth token on export", async () => {
    const res = await request(app).post("/api/v1/settings/export");
    expect(res.status).toBe(401);
  });
});
