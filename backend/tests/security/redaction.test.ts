import { describe, expect, it } from "vitest";
import { redact } from "../../src/shared/utils/redaction.js";
describe("structured redaction", () => {
 it("scrubs nested secrets, camel-case credentials, cookies and restricted content", () => {
  const value = redact({requestId:"safe", nested:[{currentPassword:"sensitive",refreshToken:"sensitive",Cookie:"sensitive",journal_text:"sensitive",messages:["sensitive"],clientSecret:"sensitive"}]});
  expect(JSON.stringify(value)).not.toContain("sensitive");
  expect(value).toMatchObject({requestId:"safe"});
 });
 it("scrubs bearer/JWT values and terminates cyclic objects", () => {
  const cycle: Record<string, unknown> = {description:"Bearer credential eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature"}; cycle.self=cycle;
  expect(JSON.stringify(redact(cycle))).not.toContain("credential");
  expect(JSON.stringify(redact(cycle))).not.toContain("eyJ");
 });
});
