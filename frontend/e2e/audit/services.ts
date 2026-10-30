// No auth credentials or production API destination.
export async function rpc(method: string, args: unknown[]) {
  const response = await fetch("/__fixtures/rpc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, args }) });
  if (!response.ok) throw new Error("Synthetic fixture unavailable");
  return response.json();
}
export const calendarApi = { list: (...args: unknown[]) => rpc("calendar", args) };
export const professionalApi = { appointments: (...args: unknown[]) => rpc("appointments", args) };
export const getJournalService = () => ({ listEntries: (...args: unknown[]) => rpc("journals", args), getAnalysis: (...args: unknown[]) => rpc("analysis", args) });
