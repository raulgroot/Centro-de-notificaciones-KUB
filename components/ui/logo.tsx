import { cn } from "@/lib/utils";

/**
 * Kublau brand logo.
 *
 * Inline SVG approximation — replace with `<Image src="/kublau-logo.svg" />` once
 * the real SVG asset is dropped in `public/`.
 */
export function KublauLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="h-6 w-6">
        <path d="M5 7 L19 7 L25 16 L17 25 L5 25 L11 16 Z" fill="#2563eb" />
      </svg>
      <span className="text-lg font-bold tracking-tight text-neutral-900">kublau</span>
    </div>
  );
}
