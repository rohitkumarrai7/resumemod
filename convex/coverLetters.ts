import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    userId: v.id("users"),
    jobId: v.optional(v.id("jobs")),
    resumeVersionId: v.optional(v.id("resumeVersions")),
    tone: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("coverLetters", {
      userId: args.userId,
      jobId: args.jobId,
      resumeVersionId: args.resumeVersionId,
      tone: args.tone,
      content: args.content,
      status: "draft",
    });

    await ctx.db.insert("usageEvents", {
      userId: args.userId,
      type: "cover_letter",
      metadata: { coverLetterId: id, jobId: args.jobId },
    });

    return { id };
  },
});

export const update = mutation({
  args: {
    coverLetterId: v.id("coverLetters"),
    content: v.optional(v.string()),
    tone: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {};
    if (args.content !== undefined) patch.content = args.content;
    if (args.tone !== undefined) patch.tone = args.tone;
    if (args.status !== undefined) patch.status = args.status;
    await ctx.db.patch(args.coverLetterId, patch);
  },
});

export const get = query({
  args: { coverLetterId: v.id("coverLetters") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.coverLetterId);
  },
});

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("coverLetters")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(50);
  },
});
