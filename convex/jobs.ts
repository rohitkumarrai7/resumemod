import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const save = mutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    company: v.optional(v.string()),
    location: v.optional(v.string()),
    description: v.string(),
    salary: v.optional(v.string()),
    employmentType: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    applyUrl: v.optional(v.string()),
    pageUrl: v.string(),
    source: v.optional(v.string()),
    atsScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, pageUrl, ...data } = args;

    if (pageUrl) {
      const existing = await ctx.db
        .query("jobs")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("pageUrl"), pageUrl))
        .first();
      if (existing) return existing._id;
    }

    const jobId = await ctx.db.insert("jobs", {
      userId,
      ...data,
      pageUrl,
      status: "saved",
      stage: "wishlist",
      atsScore: args.atsScore,
    });
    return jobId;
  },
});

export const list = query({
  args: {
    userId: v.id("users"),
    status: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("jobs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId));

    const all = await q.order("desc").collect();

    let filtered = all;
    if (args.status) {
      filtered = filtered.filter((j) => j.status === args.status);
    }
    if (args.source) {
      filtered = filtered.filter((j) => j.source === args.source);
    }

    return filtered.map((j) => ({
      id: j._id,
      title: j.title,
      company: j.company,
      location: j.location,
      description: j.description,
      salary: j.salary,
      employmentType: j.employmentType,
      skills: j.skills || [],
      applyUrl: j.applyUrl,
      pageUrl: j.pageUrl,
      source: j.source,
      status: j.status,
      stage: j.stage || "wishlist",
      savedAt: j._creationTime,
      notes: j.notes,
      atsScore: j.atsScore,
    }));
  },
});

export const updateStatus = mutation({
  args: {
    jobId: v.id("jobs"),
    status: v.optional(v.string()),
    stage: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { jobId, ...updates } = args;
    const patch: Record<string, unknown> = {};
    if (updates.stage) {
      patch.stage = updates.stage;
      patch.status = updates.stage;
    } else if (updates.status) {
      patch.status = updates.status;
    }
    if (updates.stage === "applied" || updates.status === "applied") {
      patch.appliedAt = Date.now();
    }
    if (updates.notes !== undefined) patch.notes = updates.notes;
    await ctx.db.patch(jobId, patch);
    return { ok: true };
  },
});

export const remove = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.jobId);
    return { ok: true };
  },
});
