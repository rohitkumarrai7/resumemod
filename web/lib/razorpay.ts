import Razorpay from "razorpay";
import crypto from "crypto";

export type PaidTier = "pro" | "premium";

export function getRazorpayClient(): Razorpay | null {
  const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return null;
  return new Razorpay({ key_id, key_secret });
}

export function isRazorpayConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function getPlanAmount(tier: PaidTier): number {
  if (tier === "pro") {
    return parseInt(process.env.RAZORPAY_PLAN_PRO_AMOUNT || "99900", 10);
  }
  return parseInt(process.env.RAZORPAY_PLAN_PREMIUM_AMOUNT || "249900", 10);
}

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return expected === signature;
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return expected === signature;
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://canny-woodpecker-211.convex.site";

export async function syncTierToConvex(payload: {
  userId?: string;
  clerkId?: string;
  email?: string;
  tier: string;
  razorpayPaymentId: string;
  razorpayOrderId?: string;
  razorpaySubscriptionId?: string;
  amount?: number;
  currency?: string;
}) {
  const internalSecret =
    process.env.RAZORPAY_WEBHOOK_INTERNAL_SECRET || process.env.CLERK_SYNC_SECRET;
  if (!internalSecret) {
    throw new Error("Billing sync secret not configured");
  }

  const res = await fetch(`${API_URL}/v1/billing/razorpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, internalSecret }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Convex billing sync failed" }));
    throw new Error(err.detail || "Convex billing sync failed");
  }

  return res.json();
}
