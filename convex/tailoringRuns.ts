import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { scoreResumeAgainstJD } from "./atsScoring";

export const create = mutation({
  args: {
    userId: v.id("users"),
    resumeId: v.optional(v.id("resumes")),
    jobId: v.optional(v.id("jobs")),
    resumeText: v.string(),
    jobDescription: v.string(),
    jobTitle: v.optional(v.string()),
    company: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const beforeResult = scoreResumeAgainstJD(args.resumeText, args.jobDescription);
    const scoreBefore = beforeResult.overallScore;

    const runId = await ctx.db.insert("tailoringRuns", {
      userId: args.userId,
      resumeId: args.resumeId,
      jobId: args.jobId,
      status: "pending",
      scoreBefore,
      suggestions: [],
    });

    // Track usage
    const user = await ctx.db.get(args.userId);
    if (user) {
      const now = Date.now();
      const resetAt = user.tailorsResetAt || 0;
      const monthMs = 30 * 24 * 60 * 60 * 1000;
      const current = (now - resetAt > monthMs) ? 0 : (user.tailorsThisMonth || 0);
      await ctx.db.patch(args.userId, {
        tailorsThisMonth: current + 1,
        tailorsResetAt: (now - resetAt > monthMs) ? now : resetAt,
        analysesCount: (user.analysesCount || 0) + 1,
      });
    }

    await ctx.db.insert("usageEvents", {
      userId: args.userId,
      type: "tailor",
      metadata: {
        runId,
        jobTitle: args.jobTitle,
        company: args.company,
        scoreBefore,
      },
    });

    return { runId, scoreBefore };
  },
});

export const complete = mutation({
  args: {
    runId: v.id("tailoringRuns"),
    scoreAfter: v.number(),
    suggestions: v.any(),
    latexSource: v.optional(v.string()),
    provider: v.optional(v.string()),
    latencyMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: "completed",
      scoreAfter: args.scoreAfter,
      suggestions: args.suggestions,
      latexSource: args.latexSource,
      provider: args.provider,
      latencyMs: args.latencyMs,
      completedAt: Date.now(),
    });
  },
});

export const fail = mutation({
  args: {
    runId: v.id("tailoringRuns"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: "failed",
      error: args.error,
      completedAt: Date.now(),
    });
  },
});

export const get = query({
  args: { runId: v.id("tailoringRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Tailoring run not found");
    return {
      id: run._id,
      ...run,
    };
  },
});

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tailoringRuns")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(50);
  },
});
