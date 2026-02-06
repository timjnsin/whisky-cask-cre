import { WarehouseAdapter } from "./adapter.js";

export class DramsSoapAdapter implements WarehouseAdapter {
  constructor(private readonly endpoint: string) {}

  private unsupported(method: string): never {
    throw new Error(
      `DramsSoapAdapter.${method} is not implemented. Add SOAP/XML adapter against endpoint ${this.endpoint}.`,
    );
  }

  getInventory() {
    return this.unsupported("getInventory");
  }

  getGaugeRecord() {
    return this.unsupported("getGaugeRecord");
  }

  getEstimate() {
    return this.unsupported("getEstimate");
  }

  getLifecycle() {
    return this.unsupported("getLifecycle");
  }

  getCaskBatch() {
    return this.unsupported("getCaskBatch");
  }

  getRecentLifecycle() {
    return this.unsupported("getRecentLifecycle");
  }

  getSummary() {
    return this.unsupported("getSummary");
  }

  getMarketData() {
    return this.unsupported("getMarketData");
  }

  getReferenceValuation() {
    return this.unsupported("getReferenceValuation");
  }

  recordLifecycle() {
    return this.unsupported("recordLifecycle");
  }
}
