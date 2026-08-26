export function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function dateKey(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}
