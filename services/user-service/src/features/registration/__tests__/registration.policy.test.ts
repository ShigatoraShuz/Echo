import { describe, expect, it } from "vitest";
import { PASSWORD_PATTERN } from "../registration.service.js";
describe("ECHO password policy", () => {
  it("matches the configured lowercase uppercase digit and length requirements", () => {
    expect(PASSWORD_PATTERN.test("SecurePass1")).toBe(true);
    expect(PASSWORD_PATTERN.test("securepass1")).toBe(false);
    expect(PASSWORD_PATTERN.test("SECUREPASS1")).toBe(false);
    expect(PASSWORD_PATTERN.test("SecurePass")).toBe(false);
    expect(PASSWORD_PATTERN.test("Short1A")).toBe(false);
  });
});
