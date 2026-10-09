import type { SVGProps } from "react";

type LogoVariant = "full" | "compact";
type LogoAppearance = "light" | "dark" | "monochrome";

type ResilliaLogoProps = Omit<SVGProps<SVGSVGElement>, "aria-label"> & {
  variant?: LogoVariant;
  appearance?: LogoAppearance;
};

const PALETTES: Record<LogoAppearance, { mark: string; accent: string; word: string }> = {
  light: { mark: "#285C4D", accent: "#73B99B", word: "#0B1320" },
  dark: { mark: "#A7E8C7", accent: "#F5F1E8", word: "#F5F1E8" },
  monochrome: { mark: "currentColor", accent: "currentColor", word: "currentColor" },
};

/** Resillia R monogram: one continuous route from the upright to the open-ended recovery stroke. */
export function ResilliaLogo({ variant = "full", appearance = "light", className, ...props }: ResilliaLogoProps) {
  const colors = PALETTES[appearance];
  const compact = variant === "compact";

  return (
    <svg
      {...props}
      className={className}
      viewBox={compact ? "0 0 48 48" : "0 0 190 48"}
      role="img"
      aria-label={compact ? "Symbole Resillia" : "Resillia"}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12.5 38V10.5h12.8c7.5 0 11.7 4.1 11.7 10.2S32.8 31 25.3 31H12.5m12.8 0L37 42.5"
        fill="none"
        stroke={colors.mark}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M34.2 42.5h7.2" fill="none" stroke={colors.accent} strokeWidth="3.2" strokeLinecap="round" />
      {!compact && (
        <text x="59" y="33" fill={colors.word} fontFamily="Inter, ui-sans-serif, sans-serif" fontSize="28" fontWeight="650" letterSpacing="-.7">
          Resillia
        </text>
      )}
    </svg>
  );
}
