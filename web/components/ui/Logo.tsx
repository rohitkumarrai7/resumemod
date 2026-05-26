import Link from "next/link";
import { cn } from "@/lib/utils";
import { LogoMark } from "./LogoMark";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
  href?: string;
  variant?: "full" | "mark";
}

const sizes = {
  sm: { mark: 28, text: "text-sm" },
  md: { mark: 36, text: "text-lg" },
  lg: { mark: 44, text: "text-xl" },
};

export function Logo({
  size = "md",
  showText = true,
  className,
  href = "/",
  variant = "full",
}: LogoProps) {
  const s = sizes[size];

  const content =
    variant === "mark" || !showText ? (
      <LogoMark size={s.mark} className={className} />
    ) : (
      <div className={cn("flex items-center gap-2.5", className)}>
        <LogoMark size={s.mark} />
        <span className={cn(s.text, "font-bold text-foreground tracking-tight")}>Fluxpage</span>
      </div>
    );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center">
        {content}
      </Link>
    );
  }
  return content;
}
