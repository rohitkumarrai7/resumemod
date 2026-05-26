import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "h-5 w-5 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-[3px]",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-primary/20 border-t-primary",
        sizes[size],
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function SpinnerCenter({ size = "md", className }: SpinnerProps) {
  return (
    <div className={cn("flex items-center justify-center py-12", className)}>
      <Spinner size={size} />
    </div>
  );
}
