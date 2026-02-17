"use client";

import { useMemo, useState } from "react";
import { CaskRow } from "@/components/cask-row";
import {
  calcAverageAgeMonths,
  formatFixed,
  formatInt,
} from "@/lib/format";
import { CaskBatchItem, LifecycleState, PortfolioSummaryResponse, SpiritType } from "@/lib/types";

interface CaskTableProps {
  summary: PortfolioSummaryResponse;
  items: CaskBatchItem[];
  initialExpandedCaskId?: number;
}

type SortKey = "id" | "fillDate" | "pg";

type SortDirection = "asc" | "desc";

function sortItems(items: CaskBatchItem[], key: SortKey, direction: SortDirection): CaskBatchItem[] {
  const copy = [...items];

  copy.sort((a, b) => {
    let delta = 0;

    if (key === "id") {
      delta = a.gaugeRecord.caskId - b.gaugeRecord.caskId;
    } else if (key === "fillDate") {
      delta = a.gaugeRecord.fillDate.localeCompare(b.gaugeRecord.fillDate);
    } else if (key === "pg") {
      delta = a.gaugeRecord.lastGaugeProofGallons - b.gaugeRecord.lastGaugeProofGallons;
    }

    return direction === "asc" ? delta : -delta;
  });

  return copy;
}

export function CaskTable({ summary, items, initialExpandedCaskId }: CaskTableProps) {
  const [searchId, setSearchId] = useState("");
  const [spiritFilter, setSpiritFilter] = useState<SpiritType | "all">("all");
  const [stateFilter, setStateFilter] = useState<LifecycleState | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [expandedCaskId, setExpandedCaskId] = useState<number | null>(initialExpandedCaskId ?? null);

  function toggleSort(next: SortKey) {
    if (sortKey === next) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(next);
    setSortDirection("asc");
  }

  const filteredItems = useMemo(() => {
    const search = searchId.trim();

    const subset = items.filter((item) => {
      if (search.length > 0 && String(item.gaugeRecord.caskId) !== search) return false;
      if (spiritFilter !== "all" && item.gaugeRecord.spiritType !== spiritFilter) return false;
      if (stateFilter !== "all" && item.gaugeRecord.state !== stateFilter) return false;
      return true;
    });

    return sortItems(subset, sortKey, sortDirection);
  }, [items, searchId, spiritFilter, stateFilter, sortKey, sortDirection]);

  const averageAgeMonths = calcAverageAgeMonths(
    items.map((item) => item.gaugeRecord.fillDate),
    summary.asOf,
  );

  const averageAngelShare =
    items.length > 0
      ? (items.reduce((sum, item) => sum + item.estimate.angelShareRate, 0) / items.length) * 100
      : 0;

  return (
    <div className="section-stack">
      <section className="metric-grid cask-summary-grid">
        <article className="panel metric-card">
          <p className="metric-label">Total Casks</p>
          <p className="metric-value">{formatInt(summary.totalCasks)}</p>
        </article>
        <article className="panel metric-card">
          <p className="metric-label">Avg Age</p>
          <p className="metric-value">{formatInt(averageAgeMonths)} mo</p>
        </article>
        <article className="panel metric-card">
          <p className="metric-label">Total PG</p>
          <p className="metric-value">{formatFixed(summary.totalLastGaugeProofGallons, 2)}</p>
          <p className="metric-subtitle">proof gallons</p>
        </article>
        <article className="panel metric-card">
          <p className="metric-label">Est. Angel Share</p>
          <p className="metric-value">~{formatFixed(averageAngelShare, 1)}%</p>
          <p className="metric-subtitle">per year</p>
        </article>
      </section>

      <section className="panel section">
        <div className="filter-row">
          <label className="field">
            <span>Search Cask ID</span>
            <input
              type="number"
              inputMode="numeric"
              value={searchId}
              onChange={(event) => setSearchId(event.target.value)}
              placeholder="e.g. 7"
            />
          </label>

          <label className="field">
            <span>Spirit</span>
            <select
              value={spiritFilter}
              onChange={(event) => setSpiritFilter(event.target.value as SpiritType | "all")}
            >
              <option value="all">All spirits</option>
              <option value="bourbon">Bourbon</option>
              <option value="rye">Rye</option>
              <option value="malt">Malt</option>
              <option value="wheat">Wheat</option>
            </select>
          </label>

          <label className="field">
            <span>State</span>
            <select
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value as LifecycleState | "all")}
            >
              <option value="all">All states</option>
              <option value="filled">Filled</option>
              <option value="maturation">Maturation</option>
              <option value="regauged">Regauged</option>
              <option value="transfer">Transfer</option>
              <option value="bottling_ready">Bottling Ready</option>
              <option value="bottled">Bottled</option>
            </select>
          </label>
        </div>

        <div className="table-scroll">
          <table className="data-table cask-table">
            <thead>
              <tr>
                <th>
                  <button type="button" className="sort-link" onClick={() => toggleSort("id")}>
                    ID
                  </button>
                </th>
                <th>Type</th>
                <th className="desktop-only">Spirit</th>
                <th className="desktop-only">
                  <button
                    type="button"
                    className="sort-link"
                    onClick={() => toggleSort("fillDate")}
                  >
                    Filled
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-link" onClick={() => toggleSort("pg")}>
                    PG
                  </button>
                </th>
                <th>State</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <p className="empty-state">No matching casks for the current filters.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <CaskRow
                    key={item.gaugeRecord.caskId}
                    item={item}
                    expanded={expandedCaskId === item.gaugeRecord.caskId}
                    onToggle={(caskId) =>
                      setExpandedCaskId((current) => (current === caskId ? null : caskId))
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
