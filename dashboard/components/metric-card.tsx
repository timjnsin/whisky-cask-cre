interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  status?: "healthy" | "warning" | "danger";
}

export function MetricCard({ label, value, subtitle, status }: MetricCardProps) {
  return (
    <article className={`panel metric-card ${status ? `metric-${status}` : ""}`}>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {subtitle ? <p className="metric-subtitle">{subtitle}</p> : null}
    </article>
  );
}