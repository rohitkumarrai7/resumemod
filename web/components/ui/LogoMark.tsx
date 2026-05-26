import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
  size?: number;
}

/** Inline SVG mark — sky→violet gradient F with ATS score ring */
export function LogoMark({ className, size = 36 }: LogoMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Fluxpage"
      width={size}
      height={size}
      className={cn("flex-shrink-0", className)}
    >
      <defs>
        <linearGradient id="fluxpage-bg" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0369A1" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id="fluxpage-ring" x1="30" y1="28" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#fluxpage-bg)" />
      <path
        d="M15 12h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H19v5h8a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-8v5a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2z"
        fill="#fff"
      />
      <circle
        cx="33"
        cy="33"
        r="7"
        stroke="url(#fluxpage-ring)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="28 44"
        transform="rotate(-90 33 33)"
      />
    </svg>
  );
}
