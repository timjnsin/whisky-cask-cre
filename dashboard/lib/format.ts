import {
  CaskType,
  LifecycleState,
  SpiritType,
} from "@/lib/types";

const numberFormatter = new Intl.NumberFormat("en-US");
const numberFormatter2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatInt(value: number | bigint): string {
  return numberFormatter.format(typeof value === "bigint" ? Number(value) : value);
}

export function formatFixed(value: number, digits = 2): string {
  if (digits === 2) return numberFormatter2.format(value);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPg(value: number): string {
  return `${formatFixed(value, 2)} PG`;
}

export function formatWg(value: number): string {
  return `${formatFixed(value, 2)} WG`;
}

export function formatProof(value: number): string {
  return `${formatFixed(value, 1)}\u00b0 proof`;
}

export function formatHash(hash: string, lead = 6, tail = 4): string {
  if (!hash || hash.length <= lead + tail + 2) return hash;
  return `${hash.slice(0, lead + 2)}...${hash.slice(-tail)}`;
}

export function formatUnixSeconds(seconds: bigint | number): string {
  const ms = Number(seconds) * 1000;
  return formatDateTime(new Date(ms).toISOString());
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    hour12: false,
  }).format(date);
}

export function formatMonthYear(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatRelativeFromUnixSeconds(seconds: bigint): string {
  const target = Number(seconds) * 1000;
  if (!Number.isFinite(target) || target <= 0) return "-";
  return formatRelative(target);
}

export function formatRelativeFromIso(iso: string): string {
  const target = new Date(iso).getTime();
  if (!Number.isFinite(target)) return "-";
  return formatRelative(target);
}

function formatRelative(targetMs: number): string {
  const diffMs = Date.now() - targetMs;
  const abs = Math.abs(diffMs);
  const direction = diffMs >= 0 ? "ago" : "from now";

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < minute) return "just now";
  if (abs < hour) return `${Math.floor(abs / minute)}m ${direction}`;
  if (abs < day) return `${Math.floor(abs / hour)}h ${direction}`;
  return `${Math.floor(abs / day)}d ${direction}`;
}

export function ratioFrom1e18(ratio: bigint): number {
  return Number(ratio) / 1e18;
}

export function formatReserveRatio(ratio: bigint): string {
  return ratioFrom1e18(ratio).toFixed(4);
}

export function caskTypeLabel(value: CaskType): string {
  switch (value) {
    case "bourbon_barrel":
      return "Bourbon Barrel";
    case "sherry_butt":
      return "Sherry Butt";
    case "hogshead":
      return "Hogshead";
    case "port_pipe":
      return "Port Pipe";
    default:
      return value;
  }
}

export function spiritTypeLabel(value: SpiritType): string {
  switch (value) {
    case "bourbon":
      return "Bourbon";
    case "rye":
      return "Rye";
    case "malt":
      return "Malt";
    case "wheat":
      return "Wheat";
    default:
      return value;
  }
}

export function lifecycleStateLabel(value: LifecycleState): string {
  switch (value) {
    case "filled":
      return "Filled";
    case "maturation":
      return "Maturation";
    case "regauged":
      return "Regauged";
    case "transfer":
      return "Transfer";
    case "bottling_ready":
      return "Bottling Ready";
    case "bottled":
      return "Bottled";
    default:
      return value;
  }
}

export function lifecycleStateShortLabel(value: LifecycleState): string {
  switch (value) {
    case "maturation":
      return "Mat";
    case "regauged":
      return "Reg";
    case "bottling_ready":
      return "BtlR";
    default:
      return lifecycleStateLabel(value);
  }
}

export function lifecycleStateColor(value: LifecycleState): string {
  switch (value) {
    case "maturation":
      return "var(--green)";
    case "regauged":
      return "var(--blue)";
    case "transfer":
      return "var(--amber)";
    case "bottling_ready":
      return "var(--amber)";
    case "filled":
    case "bottled":
      return "var(--text-dim)";
    default:
      return "var(--text-dim)";
  }
}

export function calcAverageAgeMonths(fillDates: string[], asOfIso: string): number {
  const asOf = new Date(asOfIso).getTime();
  if (!Number.isFinite(asOf) || fillDates.length === 0) return 0;

  const months = fillDates.map((fillDate) => {
    const ts = new Date(fillDate).getTime();
    if (!Number.isFinite(ts)) return 0;
    const delta = Math.max(0, asOf - ts);
    return delta / (1000 * 60 * 60 * 24 * 30.4375);
  });

  const total = months.reduce((sum, value) => sum + value, 0);
  return Math.round(total / fillDates.length);
}

export function safeBigIntToNumber(value: bigint): number {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (value > max) return Number.MAX_SAFE_INTEGER;
  if (value < -max) return -Number.MAX_SAFE_INTEGER;
  return Number(value);
}