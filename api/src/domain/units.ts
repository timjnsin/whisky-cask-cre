export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return Math.max(0, Math.floor((to - from) / (1000 * 60 * 60 * 24)));
}

export function monthsBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const years = to.getUTCFullYear() - from.getUTCFullYear();
  const months = to.getUTCMonth() - from.getUTCMonth();
  return Math.max(0, years * 12 + months);
}

export function subtractDays(iso: string, days: number): string {
  const dt = new Date(iso);
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString();
}

export function subtractMonths(iso: string, months: number): string {
  const dt = new Date(iso);
  dt.setUTCMonth(dt.getUTCMonth() - months);
  return dt.toISOString();
}

export function proofGallons(wineGallons: number, proof: number): number {
  return round2(wineGallons * (proof / 100));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function toScaled2(value: number): bigint {
  return BigInt(Math.round(value * 100));
}

export function toScaled1(value: number): bigint {
  return BigInt(Math.round(value * 10));
}
