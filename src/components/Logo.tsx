import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Valu8 wordmark — text-only, premium.
 * Sophisticated tracking, with the "8" rendered as a hero accent
 * in metallic teal gradient.
 */
export function Logo({ className, size = "md" }: LogoProps) {
  const sizes = {
    sm: "text-xl",
    md: "text-2xl sm:text-[26px]",
    lg: "text-4xl sm:text-5xl",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-baseline font-semibold tracking-[-0.02em] select-none leading-none",
        sizes[size],
        className,
      )}
      style={{ fontFeatureSettings: '"ss01", "cv11"' }}
    >
      <span className="text-foreground">Valu</span>
      <span
        className="ml-[1px] font-bold italic"
        style={{
          background:
            "linear-gradient(160deg, hsl(176 100% 70%) 0%, hsl(176 100% 42%) 45%, hsl(176 100% 30%) 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          textShadow: "0 0 24px hsl(176 100% 42% / 0.35)",
        }}
      >
        8
      </span>
    </span>
  );
}
