import { cn } from "@/lib/utils";

/**
 * Kublau brand logo. Renders the icon (lightning K) inline + "kublau" wordmark.
 * The full official SVG (icon + wordmark) also lives at `/public/kublau-logo.svg`.
 */
export function KublauLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <KublauIcon className="h-7 w-auto" />
      <span className="text-lg font-bold tracking-tight text-neutral-900">kublau</span>
    </div>
  );
}

/** Icon-only variant (the lightning K). */
export function KublauIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 336 475"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M3.49961 263L64.1996 202.3L133.2 133.3L72.6996 72.8C67.8996 68 67.8996 60.3 72.6996 55.6L124.7 3.6C129.5 -1.2 137.2 -1.2 141.9 3.6L202.5 64.2L271.7 133.4L332.3 194C337.1 198.8 337.1 206.5 332.3 211.2L280.3 263.2C275.5 268 267.8 268 263.1 263.2L211.8 211.9C206.7 206.8 198.5 206.8 193.4 211.9L142 263C137.3 267.7 137.3 275.3 142 280.1L193.5 331.6C198.6 336.7 206.8 336.7 211.9 331.6L263.3 280.2C268 275.5 275.6 275.5 280.4 280.2L332.6 332.4C337.3 337.1 337.3 344.7 332.6 349.5L271.8 410.1L211.2 470.7C206.5 475.4 198.9 475.4 194.1 470.7L3.49961 280C-1.20039 275.3 -1.20039 267.7 3.49961 263Z"
        fill="#006BFF"
      />
    </svg>
  );
}
