export function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-[var(--radius-thumb)] border border-line bg-surface/50 px-5 py-4">
      <p className="type-label text-fg-faint">{label}</p>
      <p className="type-display mt-2 text-[28px] tabular-nums">{value}</p>
      {note && <p className="type-meta mt-0.5 text-fg-faint">{note}</p>}
    </div>
  );
}

export const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** 45s, 8m, 1.2h. Shared by server pages and the client chart. */
export function formatWatch(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)}h`;
}
