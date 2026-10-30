import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { assertConsultationPortsAvailable, consultationSelection, waitForConsultation } from "../scripts/lib/consultation-startup.mts";
import { modelEvidenceDirectory } from "../scripts/lib/model-evidence.mts";

test("accepts explicit real selections, rejects null/guided/malformed selections", () => {
  const config = { schemaVersion: "echo-consultation-selection-v1", researchDiagnostic: "fictional-classifier@v1", cbtGeneration: "fictional-generator@v1" };
  assert.equal(consultationSelection(config).cbtGeneration, "fictional-generator@v1");
  for (const value of [null, {}, { ...config, cbtGeneration: null }, { ...config, cbtGeneration: "x && unsafe" }, { ...config, researchDiagnostic: "../outside" }]) assert.throws(() => consultationSelection(value));
});
test("occupied ports fail without killing the listener or choosing port 3100", async () => {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as { port: number }).port;
    await assert.rejects(assertConsultationPortsAvailable([port]), /occupied/);
    assert.equal(server.listening, true);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
test("readiness is bounded and does not report success for unavailable services", async () => {
  let calls = 0;
  await waitForConsultation(async () => ++calls === 2, 100, 1);
  assert.equal(calls, 2);
  await assert.rejects(waitForConsultation(async () => false, 10, 1), /did not become ready/);
});
test("separate evidence directories cannot escape the technical artifact tree", () => {
  const previous = process.env.ECHO_MODEL_EVIDENCE_DIR;
  try {
    process.env.ECHO_MODEL_EVIDENCE_DIR = "artifacts/model-integration/port3000-test";
    assert.equal(modelEvidenceDirectory("unused"), "artifacts/model-integration/port3000-test");
    for (const value of ["../outside", "C:/outside", "artifacts/model-integration/../outside", "artifacts/model-integration/example;unsafe"]) {
      process.env.ECHO_MODEL_EVIDENCE_DIR = value;
      assert.throws(() => modelEvidenceDirectory("unused"));
    }
  } finally { if (previous === undefined) delete process.env.ECHO_MODEL_EVIDENCE_DIR; else process.env.ECHO_MODEL_EVIDENCE_DIR = previous; }
});
