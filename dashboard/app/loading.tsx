function SkeletonCard() {
  return (
    <div className="panel metric-card" aria-hidden>
      <div className="skeleton skeleton-label" />
      <div className="skeleton skeleton-value" />
      <div className="skeleton skeleton-subtitle" />
    </div>
  );
}

export default function Loading() {
  return (
    <main className="app-shell">
      <div className="panel top-nav">
        <div className="skeleton skeleton-nav" />
      </div>
      <section className="metric-grid">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </section>
      <section className="panel section">
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
      </section>
    </main>
  );
}