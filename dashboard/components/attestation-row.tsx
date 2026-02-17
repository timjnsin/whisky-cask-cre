import { CopyButton } from "@/components/copy-button";
import {
  formatHash,
  formatReserveRatio,
  formatUnixSeconds,
} from "@/lib/format";
import { AttestationLogEntry } from "@/lib/types";

interface AttestationRowProps {
  entry: AttestationLogEntry;
}

export function AttestationRow({ entry }: AttestationRowProps) {
  const statusText =
    entry.mode === "confidential"
      ? entry.isFullyReserved
        ? "reserved"
        : "under"
      : (entry.reserveRatio ?? 0n) >= 10n ** 18n
        ? "reserved"
        : "under";

  return (
    <tr>
      <td>{formatUnixSeconds(entry.timestamp)}</td>
      <td>
        <span className={`inline-status ${statusText === "reserved" ? "healthy" : "danger"}`}>
          <span className="status-dot" aria-hidden>
            \u25CF
          </span>
          {statusText}
        </span>
      </td>
      <td>
        <span className="badge badge-inline">{entry.mode}</span>
      </td>
      <td>
        {entry.mode === "public" ? (
          <span>
            {entry.physicalCaskCount?.toString() ?? "-"} casks \u00b7 ratio {formatReserveRatio(entry.reserveRatio ?? 0n)}
          </span>
        ) : (
          <span>{entry.isFullyReserved ? "boolean=true" : "boolean=false"}</span>
        )}
      </td>
      <td>
        <div className="hash-cell mono">
          <span>{formatHash(entry.attestationHash)}</span>
          <CopyButton value={entry.attestationHash} label="Copy attestation hash" />
        </div>
      </td>
    </tr>
  );
}