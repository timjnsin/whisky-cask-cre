import { WarehouseAdapter } from "./adapter.js";
import { PortfolioStore } from "../../services/portfolio.js";
import { buildReferenceValuation } from "../../services/referenceValuation.js";
import { MarketDataResponse } from "../../domain/types.js";

export class MockWarehouseAdapter implements WarehouseAdapter {
  constructor(private readonly store: PortfolioStore) {}

  getInventory(asOf: string) {
    return this.store.getInventory(asOf);
  }

  getGaugeRecord(caskId: number) {
    return this.store.getGaugeRecord(caskId);
  }

  getEstimate(caskId: number, asOf: string) {
    return this.store.getEstimate(caskId, asOf);
  }

  getLifecycle(caskId: number) {
    return this.store.getLifecycle(caskId);
  }

  getSummary(asOf: string) {
    return this.store.getSummary(asOf);
  }

  getMarketData(asOf: string): MarketDataResponse {
    return {
      source: "reference-market-index",
      asOf,
      indexReference: {
        rw101QuarterlyDeltaPct: 2.1,
        knightFrankAnnualDeltaPct: 5.4,
      },
      notes: "Reference-only market signal. Not a settlement price.",
    };
  }

  getReferenceValuation(caskId: number, asOf: string) {
    const cask = this.store.getCask(caskId);
    return cask ? buildReferenceValuation(cask, asOf) : undefined;
  }

  async recordLifecycle(payload: Parameters<PortfolioStore["appendLifecycle"]>[0]) {
    return this.store.appendLifecycle(payload);
  }
}
