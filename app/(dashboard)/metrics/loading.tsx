export default function Loading() {
  return (
    <div className="space-y-6">
      <header>
        <div className="h-8 w-40 animate-pulse rounded bg-neutral-200" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-neutral-100" />
      </header>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[110px] animate-pulse rounded-lg border border-neutral-200 bg-white"
          />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="h-[330px] animate-pulse rounded-lg border border-neutral-200 bg-white"
          />
        ))}
      </div>

      {/* Pieces table */}
      <div className="h-96 animate-pulse rounded-lg border border-neutral-200 bg-white" />
    </div>
  );
}
