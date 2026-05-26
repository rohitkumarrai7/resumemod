import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

const paddingMap = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({ children, className, padding = "md", hover }: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-card shadow-card",
        paddingMap[padding],
        hover && "hover:border-primary/30 transition-colors",
        className
      )}
    >
      {children}
    </div>
  );
}
