import { cn } from "@/lib/utils";

// BECS Analytics brand mark + wordmark (transparent SVG atom, brand colors).
export function BecsLogo({
  size = 36,
  subtitle = "Analytics",
  className,
}: {
  size?: number;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/becs-mark.svg" alt="BECS Analytics" width={size} height={size} />
      <div className="leading-none">
        <div className="text-lg font-bold tracking-tight text-[#0e3a5c] dark:text-white">
          BECS
        </div>
        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#1ca9e6]">
          {subtitle}
        </div>
      </div>
    </div>
  );
}
