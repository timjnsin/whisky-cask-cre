import Link from "next/link";
import {
  formatDateTime,
  formatPg,
  formatProof,
  formatWg,
  lifecycleStateColor,
  lifecycleStateLabel,
} from "@/lib/format";
import { LifecycleEvent } from "@/lib/types";

interface LifecycleEventCardProps {
  event: LifecycleEvent;
}

function sourceFromReason(reason: LifecycleEvent["reason"]): "webhook" | "reconcile" {
  return reason === "reconcile" ? "reconcile" : "webhook";
}

export function LifecycleEventCard({ event }: LifecycleEventCardProps) {
  const source = sourceFromReason(event.reason);
  const showGauge =
    event.gaugeProofGallons > 0 || event.gaugeWineGallons > 0 || event.gaugeProof > 0;

  return (
    <article className="panel lifecycle-event-card">
      <div className="event-header">
        <p>
          <span className="status-dot" style={{ color: lifecycleStateColor(event.toState) }} aria-hidden>
            \u25CF
          </span>{" "}
          <Link href={`/casks?focus=${event.caskId}`} className="inline-link mono">
            Cask #{event.caskId}
          </Link>{" "}
          {lifecycleStateLabel(event.fromState)} \u2192 {lifecycleStateLabel(event.toState)}
        </p>
        <span className="badge badge-inline">{source}</span>
      </div>

      <p className="meta-line">{formatDateTime(event.timestamp)}</p>

      {showGauge ? (
        <p className="event-gauge">
          {formatPg(event.gaugeProofGallons)} / {formatWg(event.gaugeWineGallons)} / {formatProof(event.gaugeProof)}
        </p>
      ) : (
        <p className="meta-line">No gauge update attached</p>
      )}
    </article>
  );
}

export function lifecycleSource(event: LifecycleEvent): "webhook" | "reconcile" {
  return sourceFromReason(event.reason);
}