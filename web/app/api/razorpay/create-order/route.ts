import { NextResponse } from "next/server";
import {
  getPlanAmount,
  getRazorpayClient,
  isRazorpayConfigured,
  type PaidTier,
} from "@/lib/razorpay";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://canny-woodpecker-211.convex.site";

export async function POST(req: Request) {
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ detail: "Razorpay not configured" }, { status: 503 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const body = await req.json().catch(() => ({}));
  const tier = body.tier as PaidTier;

  if (tier !== "pro" && tier !== "premium") {
    return NextResponse.json({ detail: "Invalid plan tier" }, { status: 400 });
  }

  const profileRes = await fetch(`${API_URL}/v1/auth/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!profileRes.ok) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  const profile = await profileRes.json();

  const razorpay = getRazorpayClient();
  if (!razorpay) {
    return NextResponse.json({ detail: "Razorpay not configured" }, { status: 503 });
  }

  const amount = getPlanAmount(tier);
  const order = await razorpay.orders.create({
    amount,
    currency: "INR",
    receipt: `fluxpage_${tier}_${profile.id}_${Date.now()}`,
    notes: {
      tier,
      userId: profile.id,
      email: profile.email,
    },
  });

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    tier,
    user: { name: profile.name, email: profile.email },
  });
}
