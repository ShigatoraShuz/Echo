/** Keep repeated live verification evidence separate without changing earlier reports. */
export function modelEvidenceDirectory(fallback: string) {
  const path = process.env.ECHO_MODEL_EVIDENCE_DIR ?? fallback;
  if (!/^artifacts\/model-integration\/[A-Za-z0-9_/-]+$/.test(path)) throw new Error("Model evidence must stay inside artifacts/model-integration.");
  return path;
}
