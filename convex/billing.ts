import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const updateTierFromPayment = mutation({
  args: {
    internalSecret: v.string(),
    clerkId: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    email: v.optional(v.string()),
    tier: v.string(),
    razorpayPaymentId: v.string(),
    razorpayOrderId: v.optional(v.string()),
    razorpaySubscriptionId: v.optional(v.string()),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const expected =
      process.env.RAZORPAY_WEBHOOK_INTERNAL_SECRET || process.env.CLERK_SYNC_SECRET;
    if (!expected || args.internalSecret !== expected) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("payments")
      .withIndex("by_razorpay_payment", (q) =>
        q.eq("razorpayPaymentId", args.razorpayPaymentId)
      )
      .first();
    if (existing) {
      return { ok: true, alreadyProcessed: true, tier: existing.tier };
    }

    let user = null;
    if (args.userId) {
      user = await ctx.db.get(args.userId);
    } else if (args.clerkId) {
      user = await ctx.db
        .query("users")
        .withIndex("by_clerk", (q) => q.eq("clerkId", args.clerkId))
        .first();
    } else if (args.email) {
      const email = args.email;
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
    }

    if (!user) {
      throw new Error("User not found");
    }

    const validTiers = ["pro", "premium"];
    if (!validTiers.includes(args.tier)) {
      throw new Error("Invalid tier");
    }

    await ctx.db.patch(user._id, {
      tier: args.tier,
      ...(args.razorpaySubscriptionId
        ? { razorpaySubscriptionId: args.razorpaySubscriptionId }
        : {}),
    });

    await ctx.db.insert("payments", {
      userId: user._id,
      razorpayPaymentId: args.razorpayPaymentId,
      razorpayOrderId: args.razorpayOrderId,
      tier: args.tier,
      amount: args.amount,
      currency: args.currency || "INR",
      status: "captured",
      createdAt: Date.now(),
    });

    return { ok: true, tier: args.tier, userId: user._id };
  },
});
