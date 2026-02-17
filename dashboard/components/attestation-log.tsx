import { AttestationRow } from "@/components/attestation-row";
import { AttestationLogEntry } from "@/lib/types";

interface AttestationLogProps {
  entries: AttestationLogEntry[];
}

export function AttestationLog({ entries }: AttestationLogProps) {
  return (
    <section className="panel section">
      <div className="section-header-row">
        <h2 className="section-title">Attestation Log</h2>
      </div>

      {entries.length === 0 ? (
        <p className="empty-state">
          No attestations recorded. The proof-of-reserve workflow runs hourly; the first attestation will appear after the next CRE execution.
        </p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Status</th>
                <th>Mode</th>
                <th>Detail</th>
                <th>Attestation Hash</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <AttestationRow key={`${entry.txHash}-${index}`} entry={entry} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}