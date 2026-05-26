"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, Card, Badge, PricingGrid } from "@/components/ui";

export default function BillingPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const u = api.auth.getUser();
    setUser(u);
  }, []);

  const currentTier = user?.tier || "free";

  return (
    <div>
      <PageHeader title="Billing & Plan" subtitle="Manage your subscription and usage" />

      <Card className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted">Current Plan</div>
            <div className="text-2xl font-bold text-foreground capitalize">{currentTier}</div>
          </div>
          <Badge variant="primary" className="capitalize">{currentTier}</Badge>
        </div>
      </Card>

      <PricingGrid isLoggedIn />

      <Card className="mt-8 bg-amber-50 border-amber-200" padding="md">
        <p className="text-sm text-amber-800">
          <strong>Note:</strong> Stripe payment integration is being configured. Upgrade buttons will redirect to Stripe Checkout once the integration is live.
        </p>
      </Card>
    </div>
  );
}
