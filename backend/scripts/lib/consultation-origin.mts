/** The live consultation may use 3000; existing isolated regressions retain 3100. */
export function consultationFrontendPort(): "3000" | "3100" {
  const value = process.argv.includes("--live") ? "3000" : process.env.ECHO_CONSULTATION_FRONTEND_PORT ?? "3100";
  if (value !== "3000" && value !== "3100") throw new Error("Consultation frontend must use loopback port 3000 or 3100.");
  return value;
}
export const consultationOrigin = () => `http://127.0.0.1:${consultationFrontendPort()}`;
