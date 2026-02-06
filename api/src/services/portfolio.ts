import { promises as fs } from "node:fs";
import path from "node:path";
import {
  CaskRecord,
  GaugeRecordResponse,
  LifecycleEvent,
  LifecycleWebhookPayload,
  PortfolioData,
  PortfolioSummaryResponse,
} from "../domain/types.js";
import { round2 } from "../domain/units.js";
import { buildInventoryResponse } from "./attestation.js";
import { estimateCask } from "./estimate.js";
import { generatePortfolioData } from "./seed.js";

const DATA_PATH = path.resolve(process.cwd(), "api/data/portfolio.json");

function toGaugeRecord(cask: CaskRecord): GaugeRecordResponse {
  return {
    caskId: cask.caskId,
    packageId: cask.packageId,
    spiritType: cask.spiritType,
    caskType: cask.caskType,
    dspNumber: cask.dspNumber,
    warehouseId: cask.warehouseId,
    fillDate: cask.fillDate,
    entryProofGallons: cask.entryGauge.proofGallons,
    entryWineGallons: cask.entryGauge.wineGallons,
    entryProof: cask.entryGauge.proof,
    lastGaugeProofGallons: cask.lastGauge.proofGallons,
    lastGaugeWineGallons: cask.lastGauge.wineGallons,
    lastGaugeProof: cask.lastGauge.proof,
    lastGaugeDate: cask.lastGauge.date,
    lastGaugeMethod: cask.lastGauge.method,
    state: cask.state,
    updatedAt: cask.updatedAt,
  };
}

function sortLifecycle(events: LifecycleEvent[]): LifecycleEvent[] {
  return [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export class PortfolioStore {
  private data: PortfolioData | null = null;

  async init(): Promise<void> {
    try {
      const raw = await fs.readFile(DATA_PATH, "utf8");
      this.data = JSON.parse(raw) as PortfolioData;
    } catch {
      this.data = generatePortfolioData();
      await this.persist();
    }
  }

  getAllCasks(): CaskRecord[] {
    if (!this.data) throw new Error("PortfolioStore not initialized");
    return this.data.casks;
  }

  getCask(caskId: number): CaskRecord | undefined {
    return this.getAllCasks().find((cask) => cask.caskId === caskId);
  }

  getGaugeRecord(caskId: number): GaugeRecordResponse | undefined {
    const cask = this.getCask(caskId);
    return cask ? toGaugeRecord(cask) : undefined;
  }

  getEstimate(caskId: number, asOf: string) {
    const cask = this.getCask(caskId);
    return cask ? estimateCask(cask, asOf) : undefined;
  }

  getLifecycle(caskId: number): LifecycleEvent[] | undefined {
    const cask = this.getCask(caskId);
    return cask ? sortLifecycle(cask.lifecycle) : undefined;
  }

  getInventory(asOf: string) {
    const active = this.getAllCasks().filter((cask) => cask.state !== "bottled");
    const totalProofGallons = round2(
      active.reduce((sum, cask) => sum + cask.lastGauge.proofGallons, 0),
    );
    const totalWineGallons = round2(active.reduce((sum, cask) => sum + cask.lastGauge.wineGallons, 0));

    return buildInventoryResponse({
      asOf,
      activeIds: active.map((cask) => cask.caskId),
      totalProofGallons,
      totalWineGallons,
    });
  }

  getSummary(asOf: string): PortfolioSummaryResponse {
    const casks = this.getAllCasks();

    const ageBuckets = {
      "0_24": 0,
      "24_36": 0,
      "36_48": 0,
      "48_plus": 0,
    };

    for (const cask of casks) {
      const months = Math.max(
        0,
        Math.floor((new Date(asOf).getTime() - new Date(cask.fillDate).getTime()) / (1000 * 60 * 60 * 24 * 30.4375)),
      );
      if (months < 24) ageBuckets["0_24"] += 1;
      else if (months < 36) ageBuckets["24_36"] += 1;
      else if (months < 48) ageBuckets["36_48"] += 1;
      else ageBuckets["48_plus"] += 1;
    }

    const recentlyChangedCaskIds = casks
      .filter((cask) => new Date(cask.updatedAt).getTime() >= Date.now() - 1000 * 60 * 60 * 24 * 120)
      .map((cask) => cask.caskId)
      .sort((a, b) => a - b)
      .slice(0, 20);

    return {
      asOf,
      totalCasks: casks.length,
      totalLastGaugeProofGallons: round2(casks.reduce((sum, cask) => sum + cask.lastGauge.proofGallons, 0)),
      totalEstimatedProofGallons: round2(
        casks.reduce((sum, cask) => sum + estimateCask(cask, asOf).estimatedCurrentProofGallons, 0),
      ),
      ageBucketsMonths: ageBuckets,
      recentlyChangedCaskIds,
    };
  }

  async appendLifecycle(payload: LifecycleWebhookPayload): Promise<LifecycleEvent | undefined> {
    const cask = this.getCask(payload.caskId);
    if (!cask) return undefined;

    const timestamp = payload.timestamp ?? new Date().toISOString();
    const event: LifecycleEvent = {
      caskId: cask.caskId,
      fromState: cask.state,
      toState: payload.toState,
      timestamp,
      gaugeProofGallons: payload.gaugeProofGallons ?? 0,
      gaugeWineGallons: payload.gaugeWineGallons ?? 0,
      gaugeProof: payload.gaugeProof ?? 0,
      reason: payload.reason ?? "regauge",
    };

    cask.lifecycle.push(event);
    cask.state = payload.toState;
    cask.updatedAt = timestamp;

    if ((payload.reason === "regauge" || payload.reason === "transfer") && payload.gaugeProofGallons !== undefined) {
      cask.lastGauge = {
        proofGallons: payload.gaugeProofGallons,
        wineGallons: payload.gaugeWineGallons ?? cask.lastGauge.wineGallons,
        proof: payload.gaugeProof ?? cask.lastGauge.proof,
        date: timestamp,
        method: payload.reason === "transfer" ? "transfer" : "wet_dip",
      };
    }

    await this.persist();
    return event;
  }

  async persist(): Promise<void> {
    if (!this.data) return;
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(this.data, null, 2), "utf8");
  }
}
