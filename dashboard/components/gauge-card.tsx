interface GaugeCardProps {
  title: string;
  tierLabel: string;
  lines: string[];
}

export function GaugeCard({ title, tierLabel, lines }: GaugeCardProps) {
  return (
    <article className="panel gauge-card">
      <h4>{title}</h4>
      <p className="tier-label">{tierLabel}</p>
      <ul>
        {lines.map((line, index) => (
          <li key={`${title}-${index}`}>{line}</li>
        ))}
      </ul>
    </article>
  );
}
