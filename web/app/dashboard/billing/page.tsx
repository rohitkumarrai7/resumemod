"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type User } from "@/lib/api";
import { PageHeader, Card, Badge, PricingGrid } from "@/components/ui";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type PaidTier = "pro" | "premium";

const RAZORPAY_CONFIGURED = !!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function BillingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingTier, setLoadingTier] = useState<PaidTier | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u = api.auth.getUser();
    setUser(u);
    if (api.auth.isLoggedIn()) {
      api.auth.getProfile().then((profile) => {
        setUser((prev) => (prev ? { ...prev, tier: profile.tier } : null));
        api.auth.updateStoredTier(profile.tier);
      }).catch(() => {});
    }
  }, []);

  const handleUpgrade = useCallback(async (tier: PaidTier) => {
    setError(null);
    setMessage(null);

    if (!RAZORPAY_CONFIGURED) {
      setError("Configure Razorpay keys in your environment to enable checkout.");
      return;
    }

    const token = localStorage.getItem("rf_access_token");
    if (!token) {
      setError("Please sign in again to upgrade your plan.");
      return;
    }

    setLoadingTier(tier);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error("Could not load Razorpay checkout.");
      }

      const res = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tier }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to create order" }));
        throw new Error(err.detail || "Failed to create order");
      }

      const data = await res.json();

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "Fluxpage",
        description: `${tier.charAt(0).toUpperCase()}${tier.slice(1)} plan`,
        order_id: data.orderId,
        prefill: {
          name: data.user?.name || user?.name || "",
          email: data.user?.email || user?.email || "",
        },
        theme: { color: "#0369A1" },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verifyRes = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              tier,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          if (!verifyRes.ok) {
            const err = await verifyRes.json().catch(() => ({ detail: "Payment verification failed" }));
            setError(err.detail || "Payment verification failed");
            return;
          }

          const result = await verifyRes.json();
          const newTier = result.tier || tier;
          api.auth.updateStoredTier(newTier);
          setUser((prev) => (prev ? { ...prev, tier: newTier } : prev));
          setMessage(`Upgraded to ${newTier} successfully.`);
        },
      };

      const checkout = new window.Razorpay(options);
      checkout.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setLoadingTier(null);
    }
  }, [user?.email, user?.name]);

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

      {message && (
        <Card className="mb-6 bg-green-50 border-green-200" padding="md">
          <p className="text-sm text-green-800">{message}</p>
        </Card>
      )}

      {error && (
        <Card className="mb-6 bg-red-50 border-red-200" padding="md">
          <p className="text-sm text-red-800">{error}</p>
        </Card>
      )}

      <PricingGrid
        isLoggedIn
        currentTier={currentTier}
        onUpgrade={handleUpgrade}
        loadingTier={loadingTier}
      />

      <Card className="mt-8 bg-sky-50 border-sky-200" padding="md">
        <p className="text-sm text-sky-900">
          {RAZORPAY_CONFIGURED ? (
            <>
              <strong>Razorpay checkout</strong> is enabled. After payment, your plan tier updates automatically.
              Set webhook URL to <code className="text-xs">/api/razorpay/webhook</code> in the Razorpay dashboard.
            </>
          ) : (
            <>
              <strong>Configure Razorpay keys</strong> in <code className="text-xs">.env.local</code>{" "}
              (<code className="text-xs">NEXT_PUBLIC_RAZORPAY_KEY_ID</code>,{" "}
              <code className="text-xs">RAZORPAY_KEY_SECRET</code>,{" "}
              <code className="text-xs">RAZORPAY_WEBHOOK_SECRET</code>) to enable upgrades.
            </>
          )}
        </p>
      </Card>
    </div>
  );
}
