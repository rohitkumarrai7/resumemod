import { Card } from "./Card";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

export const PRICING_PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["5 tailors/month", "3 resumes", "Basic tracker", "PDF export", "ATS scoring"],
    cta: "Get Started",
    highlight: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$12",
    period: "/month",
    features: ["100 tailors/month", "20 resumes", "Cover letters", "PDF + DOCX export", "Interview prep", "All templates"],
    cta: "Upgrade to Pro",
    highlight: true,
  },
  {
    id: "premium" as const,
    name: "Premium",
    price: "$29",
    period: "/month",
    features: ["Unlimited tailoring", "Unlimited resumes", "Autofill (beta)", "Advanced analytics", "Priority AI models", "API access"],
    cta: "Upgrade to Premium",
    highlight: false,
  },
];

interface PricingGridProps {
  isLoggedIn?: boolean;
  className?: string;
  currentTier?: string;
  onUpgrade?: (tier: "pro" | "premium") => void;
  loadingTier?: "pro" | "premium" | null;
}

export function PricingGrid({
  isLoggedIn = false,
  className,
  currentTier = "free",
  onUpgrade,
  loadingTier = null,
}: PricingGridProps) {
  const ctaHref = isLoggedIn ? "/dashboard/billing" : "/register";

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-6", className)}>
      {PRICING_PLANS.map((plan) => {
        const isCurrent = currentTier === plan.id;
        const isPaid = plan.id === "pro" || plan.id === "premium";
        const showCheckout = isLoggedIn && isPaid && onUpgrade && !isCurrent;

        return (
          <Card
            key={plan.name}
            className={cn(
              plan.highlight && "ring-2 ring-primary/20 border-primary/30",
              isCurrent && "border-primary/40 bg-primary/5"
            )}
            padding="md"
          >
            {plan.highlight && (
              <div className="text-xs font-medium text-primary uppercase tracking-wider mb-2">Most Popular</div>
            )}
            {isCurrent && (
              <div className="text-xs font-medium text-primary uppercase tracking-wider mb-2">Current Plan</div>
            )}
            <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
            <div className="flex items-end gap-1 mt-2 mb-4">
              <span className="text-4xl font-black text-foreground">{plan.price}</span>
              <span className="text-muted text-sm mb-1">{plan.period}</span>
            </div>
            <ul className="space-y-2 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            {showCheckout ? (
              <Button
                variant={plan.highlight ? "primary" : "secondary"}
                className="w-full"
                disabled={loadingTier === plan.id}
                onClick={() => onUpgrade(plan.id)}
              >
                {loadingTier === plan.id ? "Opening checkout…" : plan.cta}
              </Button>
            ) : isCurrent ? (
              <Button variant="secondary" className="w-full" disabled>
                Current plan
              </Button>
            ) : (
              <Button
                href={ctaHref}
                variant={plan.highlight ? "primary" : "secondary"}
                className="w-full"
              >
                {isLoggedIn && isPaid ? "Manage in billing" : plan.cta}
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
}
