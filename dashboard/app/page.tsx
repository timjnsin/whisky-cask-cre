import { AttestationLog } from "@/components/attestation-log";
import { MetricCard } from "@/components/metric-card";
import { Nav } from "@/components/nav";
import { PrivacyExplainer } from "@/components/privacy-explainer";
import { ReserveStatusBadge } from "@/components/status-badge";
import {
  formatFixed,
  formatHash,
  formatInt,
  formatRelativeFromUnixSeconds,
  formatReserveRatio,
  safeBigIntToNumber,
} from "@/lib/format";
import { getDashboardReserveData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

function WarningBanner({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <section className="panel warning-banner">
      <h2>Data Warnings</h2>
      <ul>
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </section>
  );
}

export default async function ReservePage() {
  const reserve = await getDashboardReserveData();
  const lastAttestationUtc =
    reserve.lastAttestationTimestamp > 0n
      ? new Date(safeBigIntToNumber(reserve.lastAttestationTimestamp) * 1000).toUTCString()
      : "n/a";

  return (
    <main className="app-shell">
      <Nav mode={reserve.mode} active="reserve" />

      <WarningBanner warnings={reserve.warnings} />

      {reserve.mode === "confidential" ? (
        <>
          <section className="panel reserve-hero">
            <p className="metric-label">Reserve Status</p>
            <div className="hero-status">
              <ReserveStatusBadge healthy={reserve.isFullyReserved} />
            </div>
            <p className="hero-caption">
              Confidential mode stores boolean reserve status and attestation hash only.
            </p>
          </section>

          <section className="metric-grid">
            <MetricCard
              label="Token Supply"
              value={formatInt(reserve.tokenSupply)}
              subtitle={`${formatInt(reserve.tokensPerCask)} per cask`}
            />
            <MetricCard
              label="Last Attestation"
              value={formatRelativeFromUnixSeconds(reserve.lastAttestationTimestamp)}
              subtitle="hourly via CRE"
            />
            <MetricCard
              label="Attestation Hash"
              value={formatHash(reserve.attestationHash)}
              subtitle="onchain proof"
            />
          </section>

          <AttestationLog entries={reserve.attestationLog} />
          <PrivacyExplainer />
        </>
      ) : (
        <>
          <section className="metric-grid metric-grid-wide">
            <MetricCard
              label="Reserve Status"
              value={reserve.isFullyReserved ? "Fully Reserved" : "Under-Reserved"}
              status={reserve.isFullyReserved ? "healthy" : "danger"}
            />
            <MetricCard label="Cask Count" value={formatInt(reserve.physicalCaskCount)} subtitle="active" />
            <MetricCard
              label="Token Supply"
              value={formatInt(reserve.tokenSupply)}
              subtitle={`${formatInt(reserve.tokensPerCask)} per cask`}
            />
            <MetricCard
              label="Reserve Ratio"
              value={formatReserveRatio(reserve.reserveRatio)}
              status={reserve.isFullyReserved ? "healthy" : "danger"}
            />
            <MetricCard
              label="Total Proof Gallons"
              value={formatFixed(reserve.totalProofGallons, 2)}
              subtitle="from warehouse inventory"
            />
            <MetricCard
              label="Last Attestation"
              value={formatRelativeFromUnixSeconds(reserve.lastAttestationTimestamp)}
              subtitle={formatHash(reserve.attestationHash)}
            />
          </section>

          <AttestationLog entries={reserve.attestationLog} />

          {!reserve.contractAvailable ? (
            <section className="panel section">
              <h2 className="section-title">Contract Configuration</h2>
              <p className="empty-state">
                Set `NEXT_PUBLIC_VAULT_ADDRESS` and `NEXT_PUBLIC_SEPOLIA_RPC_URL` to read live reserve attestations and logs.
              </p>
            </section>
          ) : null}
        </>
      )}

      {reserve.mode === "confidential" ? null : (
        <section className="panel section">
          <h2 className="section-title">Mode Integrity</h2>
          <p className="empty-state">
            Dashboard mode is derived from the latest attestation timestamp onchain. Public and confidential views are not a UI toggle.
          </p>
          <p className="meta-line">Current as of {lastAttestationUtc}</p>
        </section>
      )}
    </main>
  );
}
