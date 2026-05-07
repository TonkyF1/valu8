import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

/**
 * Valu8 — premium text-only wordmark.
 * The "8" is the hero: italicised, weighted, and washed in a refined
 * metallic teal gradient with a soft luminous halo.
 */
export function Logo({ className, size = "md" }: LogoProps) {
  const sizes = {
    sm: { wrap: "text-[18px]", eight: "text-[20px]" },
    md: { wrap: "text-[22px] sm:text-[24px]", eight: "text-[26px] sm:text-[28px]" },
    lg: { wrap: "text-[34px]", eight: "text-[40px]" },
    xl: { wrap: "text-[56px] sm:text-[68px]", eight: "text-[64px] sm:text-[80px]" },
  } as const;

  const s = sizes[size];

  return (
    <span
      className={cn(
        "inline-flex items-baseline select-none leading-none font-semibold",
        s.wrap,
        className,
      )}
      style={{
        letterSpacing: "-0.035em",
        fontFamily:
          'ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif',
      }}
      aria-label="Valu8"
    >
      <span
        className="text-foreground"
        style={{
          background:
            "linear-gradient(180deg, hsl(40 20% 99%) 0%, hsl(40 10% 78%) 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        Valu
      </span>
      <span
        className={cn("relative italic font-bold ml-[0.5px]", s.eight)}
        style={{
          background:
            "linear-gradient(155deg, hsl(176 100% 78%) 0%, hsl(176 100% 50%) 38%, hsl(176 90% 32%) 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          letterSpacing: "-0.05em",
          textShadow: "0 0 28px hsl(176 100% 42% / 0.35)",
        }}
      >
        8
      </span>
    </span>
  );
}
