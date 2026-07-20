'use client';

export function StoreSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-[var(--bg-secondary)]/40 border border-[var(--border-color)] rounded-2xl overflow-hidden animate-pulse">
          <div className="h-32 bg-gradient-to-br from-gray-700/30 to-gray-600/10" />
          <div className="p-4 space-y-3">
            <div className="flex gap-1.5">
              <div className="h-4 w-12 rounded bg-[var(--bg-tertiary)]/50" />
              <div className="h-4 w-16 rounded bg-[var(--bg-tertiary)]/50" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded bg-[var(--bg-tertiary)]/50" />
              <div className="h-3 w-3/4 rounded bg-[var(--bg-tertiary)]/50" />
            </div>
            <div className="flex gap-1.5">
              <div className="h-5 w-14 rounded bg-[var(--bg-tertiary)]/50" />
              <div className="h-5 w-12 rounded bg-[var(--bg-tertiary)]/50" />
              <div className="h-5 w-10 rounded bg-[var(--bg-tertiary)]/50" />
            </div>
            <div className="h-3 w-32 rounded bg-[var(--bg-tertiary)]/50" />
            <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
              <div className="h-5 w-20 rounded bg-[var(--bg-tertiary)]/50" />
              <div className="h-8 w-24 rounded-lg bg-[var(--bg-tertiary)]/50" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-48 rounded-2xl bg-gradient-to-br from-gray-700/30 to-gray-600/10" />
      <div className="space-y-3">
        <div className="h-8 w-64 rounded bg-[var(--bg-tertiary)]/50" />
        <div className="h-4 w-48 rounded bg-[var(--bg-tertiary)]/50" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-[var(--bg-tertiary)]/50" />
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-[var(--bg-tertiary)]/50" />
        <div className="h-3 w-5/6 rounded bg-[var(--bg-tertiary)]/50" />
        <div className="h-3 w-4/6 rounded bg-[var(--bg-tertiary)]/50" />
      </div>
    </div>
  );
}
