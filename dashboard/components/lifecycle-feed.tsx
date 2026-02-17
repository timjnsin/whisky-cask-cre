"use client";

import { useMemo, useState } from "react";
import { LifecycleEventCard, lifecycleSource } from "@/components/lifecycle-event";
import { LifecycleEvent } from "@/lib/types";

interface LifecycleFeedProps {
  events: LifecycleEvent[];
}

export function LifecycleFeed({ events }: LifecycleFeedProps) {
  const [sourceFilter, setSourceFilter] = useState<"all" | "webhook" | "reconcile">("all");
  const [visibleCount, setVisibleCount] = useState(15);

  const filtered = useMemo(() => {
    const sorted = [...events].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (sourceFilter === "all") return sorted;
    return sorted.filter((event) => lifecycleSource(event) === sourceFilter);
  }, [events, sourceFilter]);

  const visibleEvents = filtered.slice(0, visibleCount);

  return (
    <section className="panel section">
      <div className="section-header-row">
        <h2 className="section-title">Lifecycle Events</h2>
        <label className="field inline-field">
          <span>Source</span>
          <select
            value={sourceFilter}
            onChange={(event) => {
              setSourceFilter(event.target.value as "all" | "webhook" | "reconcile");
              setVisibleCount(15);
            }}
          >
            <option value="all">All</option>
            <option value="webhook">Webhook</option>
            <option value="reconcile">Reconcile</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="empty-state">No lifecycle events in this time window.</p>
      ) : (
        <div className="event-stack">
          {visibleEvents.map((event) => (
            <LifecycleEventCard
              key={`${event.caskId}-${event.timestamp}-${event.toState}`}
              event={event}
            />
          ))}
        </div>
      )}

      {visibleCount < filtered.length ? (
        <button
          type="button"
          className="secondary-button"
          onClick={() => setVisibleCount((count) => count + 15)}
        >
          Load More
        </button>
      ) : null}
    </section>
  );
}