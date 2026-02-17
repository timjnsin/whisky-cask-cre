import {
  formatMonthYear,
  lifecycleStateColor,
  lifecycleStateLabel,
} from "@/lib/format";
import { LifecycleEvent } from "@/lib/types";

interface LifecycleTimelineProps {
  events: LifecycleEvent[];
}

export function LifecycleTimeline({ events }: LifecycleTimelineProps) {
  if (events.length === 0) {
    return <p className="empty-inline">No lifecycle events for this cask.</p>;
  }

  return (
    <div className="timeline" role="list">
      {events.map((event) => (
        <div key={`${event.caskId}-${event.timestamp}-${event.toState}`} className="timeline-node" role="listitem">
          <span
            className="timeline-dot"
            style={{ backgroundColor: lifecycleStateColor(event.toState) }}
            aria-hidden
          />
          <span className="timeline-label">{lifecycleStateLabel(event.toState)}</span>
          <span className="timeline-date">{formatMonthYear(event.timestamp)}</span>
        </div>
      ))}
    </div>
  );
}