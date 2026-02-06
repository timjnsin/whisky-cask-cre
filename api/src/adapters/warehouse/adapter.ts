import {
  CaskBatchResponse,
  EstimateResponse,
  GaugeRecordResponse,
  InventoryResponse,
  LifecycleEvent,
  LifecycleWebhookPayload,
  MarketDataResponse,
  PortfolioSummaryResponse,
  RecentLifecycleResponse,
  ReferenceValuationResponse,
} from "../../domain/types.js";

export interface WarehouseAdapter {
  getInventory(asOf: string): InventoryResponse;
  getGaugeRecord(caskId: number): GaugeRecordResponse | undefined;
  getEstimate(caskId: number, asOf: string): EstimateResponse | undefined;
  getLifecycle(caskId: number): LifecycleEvent[] | undefined;
  getCaskBatch(ids: number[] | undefined, limit: number | undefined, asOf: string): CaskBatchResponse;
  getRecentLifecycle(limit: number, asOf: string): RecentLifecycleResponse;
  getSummary(asOf: string): PortfolioSummaryResponse;
  getMarketData(asOf: string): MarketDataResponse;
  getReferenceValuation(caskId: number, asOf: string): ReferenceValuationResponse | undefined;
  recordLifecycle(payload: LifecycleWebhookPayload): Promise<LifecycleEvent | undefined>;
}
