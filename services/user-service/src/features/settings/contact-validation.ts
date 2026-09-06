/** Accept readable local/international numbers with 7–15 actual digits. */
export function validContactPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "").length;
  return /^\+?[\d ()-]{7,40}$/.test(value) && digits >= 7 && digits <= 15;
}
