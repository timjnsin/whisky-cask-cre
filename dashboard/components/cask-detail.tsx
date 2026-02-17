"use client";

import { useEffect, useState } from "react";
import { GaugeCard } from "@/components/gauge-card";
import { LifecycleTimeline } from "@/components/lifecycle-timeline";
import {
  getCaskEstimate,
  getCaskGaugeRecord,
  getCaskLifecycle,
  nowAsOf,
} from "@/lib/api";
import {
  caskTypeLabel,
  formatDateTime,
  formatPg,
  formatProof,
  formatWg,
  spiritTypeLabel,
} from "@/lib/format";
import { EstimateResponse, GaugeRecordResponse, LifecycleEvent } from "@/lib/types";

interface CaskDetailProps {
  caskId: number;
  initialGaugeRecord: GaugeRecordResponse;
  initialEstimate: EstimateResponse;
}

export function CaskDetail({ caskId, initialGaugeRecord, initialEstimate }: CaskDetailProps) {
  const [gaugeRecord, setGaugeRecord] = useState<GaugeRecordResponse>(initialGaugeRecord);
  const [estimate, setEstimate] = useState<EstimateResponse>(initialEstimate);
  const [events, setEvents] = useState<LifecycleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [gauge, estimateResponse, lifecycle] = await Promise.all([
          getCaskGaugeRecord(caskId),
          getCaskEstimate(caskId, nowAsOf()),
          getCaskLifecycle(caskId),
        ]);

        if (!active) return;
        setGaugeRecord(gauge);
        setEstimate(estimateResponse);
        setEvents([...lifecycle.events].sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
      } catch (loadError) {
        if (!active) return;
        setError(String(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [caskId]);

  return (
    <div className="cask-detail panel">
      <div className="cask-detail-header">
        <div>
          <h3>
            Cask #{gaugeRecord.caskId} \u2014 {caskTypeLabel(gaugeRecord.caskType)}
          </h3>
          <p className="meta-line mono">
            {gaugeRecord.dspNumber} \u00b7 {gaugeRecord.warehouseId} \u00b7 {gaugeRecord.packageId}
          </p>
        </div>
        <p className="meta-line">{spiritTypeLabel(gaugeRecord.spiritType)}</p>
      </div>

      {error ? <p className="empty-inline">Failed to load cask detail: {error}</p> : null}

      <div className="gauge-grid">
        <GaugeCard
          title="Entry Gauge"
          tierLabel="Tier 1: Fact"
          lines={[
            formatPg(gaugeRecord.entryProofGallons),
            formatWg(gaugeRecord.entryWineGallons),
            formatProof(gaugeRecord.entryProof),
            formatDateTime(gaugeRecord.fillDate),
            `method: entry`,
          ]}
        />
        <GaugeCard
          title="Last Gauge"
          tierLabel="Tier 1: Fact"
          lines={[
            formatPg(gaugeRecord.lastGaugeProofGallons),
            formatWg(gaugeRecord.lastGaugeWineGallons),
            formatProof(gaugeRecord.lastGaugeProof),
            formatDateTime(gaugeRecord.lastGaugeDate),
            `method: ${gaugeRecord.lastGaugeMethod}`,
          ]}
        />
        <GaugeCard
          title="Current Estimate"
          tierLabel="Tier 2: Model"
          lines={[
            formatPg(estimate.estimatedCurrentProofGallons),
            `~${estimate.estimatedBottleYield} bottles`,
            `angel: ${(estimate.angelShareRate * 100).toFixed(1)}%/yr`,
            `days since gauge: ${estimate.daysSinceLastGauge}`,
            `model: ${estimate.modelVersion}`,
          ]}
        />
      </div>

      <div className="lifecycle-block">
        <h4>Lifecycle</h4>
        {loading ? <p className="empty-inline">Loading lifecycle timeline...</p> : null}
        {!loading ? <LifecycleTimeline events={events} /> : null}
      </div>
    </div>
  );
}