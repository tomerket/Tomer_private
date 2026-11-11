export function GridSkeleton({ count = 18 }: { count?: number }) {
  return (
    <div className="video-grid" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="aspect-video rounded-[var(--radius-thumb)] bg-surface" />
          <div className="mt-3 flex gap-3">
            <div className="size-9 shrink-0 rounded-full bg-surface" />
            <div className="flex-1 space-y-2 pt-0.5">
              <div className="h-3.5 w-11/12 rounded bg-surface" />
              <div className="h-3 w-1/2 rounded bg-surface" />
              <div className="h-3 w-1/3 rounded bg-surface" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function WatchSkeleton() {
  return (
    <div className="watch-layout" aria-hidden>
      <div>
        <div className="aspect-video rounded-[var(--radius-thumb)] bg-surface" />
        <div className="mt-5 h-7 w-2/3 rounded bg-surface" />
        <div className="mt-4 h-4 w-1/3 rounded bg-surface" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex gap-3">
            <div className="aspect-video w-40 shrink-0 rounded-[var(--radius-control)] bg-surface" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3.5 w-full rounded bg-surface" />
              <div className="h-3 w-2/3 rounded bg-surface" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
