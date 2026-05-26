import { NextResponse } from "next/server";
import { syncTierToConvex, verifyWebhookSignature } from "@/lib/razorpay";

function tierFromNotes(notes: Record<string, string> | undefined): string | null {
  const tier = notes?.tier;
  if (tier === "pro" || tier === "premium") return tier;
  return null;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("X-Razorpay-Signature") || "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ detail: "Invalid webhook signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const eventType = event.event as string;

  try {
    if (eventType === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      if (!payment?.id) {
        return NextResponse.json({ ok: true, skipped: true });
      }

      const notes = payment.notes || {};
      const tier = tierFromNotes(notes);
      if (!tier) {
        return NextResponse.json({ ok: true, skipped: true });
      }

      await syncTierToConvex({
        userId: notes.userId,
        email: notes.email,
        tier,
        razorpayPaymentId: payment.id,
        razorpayOrderId: payment.order_id,
        amount: payment.amount,
        currency: payment.currency,
      });
    } else if (
      eventType === "subscription.activated" ||
      eventType === "subscription.charged"
    ) {
      const subscription = event.payload?.subscription?.entity;
      const payment = event.payload?.payment?.entity;
      const notes = subscription?.notes || payment?.notes || {};
      const tier = tierFromNotes(notes);
      const paymentId = payment?.id || `${subscription?.id}_${event.created_at}`;

      if (tier && paymentId) {
        await syncTierToConvex({
          userId: notes.userId,
          email: notes.email,
          tier,
          razorpayPaymentId: paymentId,
          razorpayOrderId: payment?.order_id,
          razorpaySubscriptionId: subscription?.id,
          amount: payment?.amount,
          currency: payment?.currency || "INR",
        });
      }
    }
  } catch (e: any) {
    console.error("Razorpay webhook error:", e);
    return NextResponse.json({ detail: e.message || "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
