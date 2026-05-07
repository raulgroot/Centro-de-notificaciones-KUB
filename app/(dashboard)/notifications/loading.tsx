export default function Loading() {
  return (
    <div className="space-y-6">
      <header>
        <div className="h-8 w-56 animate-pulse rounded bg-neutral-200" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-neutral-100" />
      </header>

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        {/* filters skeleton */}
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-neutral-50/50 px-5 py-3">
          <div className="h-9 min-w-[260px] flex-1 animate-pulse rounded-md bg-neutral-100" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 w-32 animate-pulse rounded-md bg-neutral-100" />
          ))}
          <div className="ml-auto h-9 w-20 animate-pulse rounded-md bg-neutral-200" />
        </div>

        {/* table header */}
        <div className="grid grid-cols-12 gap-4 border-b border-neutral-200 px-5 py-2.5">
          <div className="col-span-6 h-3 w-32 animate-pulse rounded bg-neutral-200" />
          <div className="col-span-4 h-3 w-20 animate-pulse rounded bg-neutral-200" />
          <div className="col-span-1 h-3 w-16 animate-pulse rounded bg-neutral-200" />
          <div className="col-span-1" />
        </div>

        {/* rows skeleton */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-12 items-center gap-4 border-b border-neutral-100 px-5 py-3.5 last:border-b-0"
          >
            <div className="col-span-6 space-y-1.5">
              <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
            </div>
            <div className="col-span-4 flex gap-1.5">
              <div className="h-5 w-12 animate-pulse rounded bg-neutral-100" />
              <div className="h-5 w-16 animate-pulse rounded bg-neutral-100" />
            </div>
            <div className="col-span-1 h-3 w-12 animate-pulse rounded bg-neutral-100" />
            <div className="col-span-1" />
          </div>
        ))}
      </section>
    </div>
  );
}
