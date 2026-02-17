import {
  CaskBatchResponse,
  CaskLifecycleResponse,
  EstimateResponse,
  GaugeRecordResponse,
  InventoryResponse,
  PortfolioSummaryResponse,
  RecentLifecycleResponse,
} from "@/lib/types";

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_WAREHOUSE_API_URL ?? "http://127.0.0.1:3000";
}

function withAsOf(path: string, asOf?: string): string {
  if (!asOf) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}asOf=${encodeURIComponent(asOf)}`;
}

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${apiBaseUrl()}${path}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText} - ${body}`);
  }

  return (await response.json()) as T;
}

export function nowAsOf(): string {
  return new Date().toISOString();
}

export async function getInventory(asOf = nowAsOf()): Promise<InventoryResponse> {
  return fetchJson<InventoryResponse>(withAsOf("/inventory", asOf));
}

export async function getPortfolioSummary(asOf = nowAsOf()): Promise<PortfolioSummaryResponse> {
  return fetchJson<PortfolioSummaryResponse>(withAsOf("/portfolio/summary", asOf));
}

export async function getCaskBatch(params?: {
  asOf?: string;
  limit?: number;
  ids?: number[];
}): Promise<CaskBatchResponse> {
  const query: string[] = [];
  if (params?.limit !== undefined) query.push(`limit=${encodeURIComponent(String(params.limit))}`);
  if (params?.ids && params.ids.length > 0) query.push(`ids=${params.ids.join(",")}`);

  const path = query.length > 0 ? `/casks/batch?${query.join("&")}` : "/casks/batch";
  return fetchJson<CaskBatchResponse>(withAsOf(path, params?.asOf ?? nowAsOf()));
}

export async function getCaskGaugeRecord(caskId: number): Promise<GaugeRecordResponse> {
  return fetchJson<GaugeRecordResponse>(`/cask/${caskId}/gauge-record`);
}

export async function getCaskEstimate(caskId: number, asOf = nowAsOf()): Promise<EstimateResponse> {
  return fetchJson<EstimateResponse>(withAsOf(`/cask/${caskId}/estimate`, asOf));
}

export async function getCaskLifecycle(caskId: number): Promise<CaskLifecycleResponse> {
  return fetchJson<CaskLifecycleResponse>(`/cask/${caskId}/lifecycle`);
}

export async function getRecentLifecycle(limit = 50, asOf = nowAsOf()): Promise<RecentLifecycleResponse> {
  return fetchJson<RecentLifecycleResponse>(withAsOf(`/lifecycle/recent?limit=${limit}`, asOf));
}