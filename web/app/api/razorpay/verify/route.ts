import { NextResponse } from "next/server";
import {
  syncTierToConvex,
  verifyPaymentSignature,
  type PaidTier,
} from "@/lib/razorpay";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://canny-woodpecker-211.convex.site";

export async function POST(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const body = await req.json().catch(() => ({}));
  const {
    tier,
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = body;

  if (!orderId || !paymentId || !signature || (tier !== "pro" && tier !== "premium")) {
    return NextResponse.json({ detail: "Invalid payment payload" }, { status: 400 });
  }

  if (!verifyPaymentSignature(orderId, paymentId, signature)) {
    return NextResponse.json({ detail: "Invalid payment signature" }, { status: 400 });
  }

  const profileRes = await fetch(`${API_URL}/v1/auth/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!profileRes.ok) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  const profile = await profileRes.json();

  const result = await syncTierToConvex({
    userId: profile.id,
    email: profile.email,
    tier: tier as PaidTier,
    razorpayPaymentId: paymentId,
    razorpayOrderId: orderId,
  });

  return NextResponse.json({ ok: true, tier: result.tier || tier });
}
