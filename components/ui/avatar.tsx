import { cn } from "@/lib/utils";

const sizes = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
} as const;

export function Avatar({
  email,
  size = "md",
  className,
}: {
  email: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const initials =
    email
      .split("@")[0]
      ?.split(/[._-]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || email.charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "bg-brand-600 flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        sizes[size],
        className,
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
