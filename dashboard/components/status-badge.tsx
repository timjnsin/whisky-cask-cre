import { AttestationMode } from "@/lib/types";

interface ModeBadgeProps {
  mode: AttestationMode;
}

interface ReserveStatusBadgeProps {
  healthy: boolean;
}

export function ModeBadge({ mode }: ModeBadgeProps) {
  return (
    <span className="badge badge-mode" title="Attestation mode">
      {mode === "confidential" ? "\uD83D\DD12 Confidential" : "Public"}
    </span>
  );
}

export function ReserveStatusBadge({ healthy }: ReserveStatusBadgeProps) {
  return (
    <span className={`badge badge-reserve ${healthy ? "healthy" : "danger"}`}>
      <span className="status-dot" aria-hidden>
        \u25CF
      </span>
      {healthy ? "Fully Reserved" : "Under-Reserved"}
    </span>
  );
}