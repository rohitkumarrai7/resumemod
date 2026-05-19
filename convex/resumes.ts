import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const upload = mutation({
  args: {
    userId: v.id("users"),
    filename: v.string(),
    mimeType: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    textPreview: v.optional(v.string()),
    rawText: v.optional(v.string()),
    structuredData: v.optional(v.any()),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const resumes = await ctx.db
      .query("resumes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const isFirst = resumes.length === 0;

    const resumeId = await ctx.db.insert("resumes", {
      userId: args.userId,
      filename: args.filename,
      mimeType: args.mimeType,
      fileSize: args.fileSize,
      textPreview: args.textPreview,
      rawText: args.rawText,
      structuredData: args.structuredData,
      label: args.label || args.filename.replace(/\.[^/.]+$/, ""),
      isDefault: isFirst,
    });

    return resumeId;
  },
});

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const resumes = await ctx.db
      .query("resumes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    return resumes.map((r) => ({
      id: r._id,
      filename: r.filename,
      mimeType: r.mimeType,
      fileSize: r.fileSize,
      textPreview: r.textPreview,
      structuredData: r.structuredData,
      label: r.label,
      isDefault: r.isDefault,
      createdAt: r._creationTime,
    }));
  },
});

export const get = query({
  args: { resumeId: v.id("resumes") },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.resumeId);
    if (!r) throw new Error("Resume not found");
    return {
      id: r._id,
      filename: r.filename,
      mimeType: r.mimeType,
      fileSize: r.fileSize,
      textPreview: r.textPreview,
      structuredData: r.structuredData,
      rawText: r.rawText,
      label: r.label,
      isDefault: r.isDefault,
      createdAt: r._creationTime,
    };
  },
});

export const setDefault = mutation({
  args: { resumeId: v.id("resumes"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const current = await ctx.db
      .query("resumes")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", args.userId).eq("isDefault", true)
      )
      .collect();
    for (const r of current) {
      await ctx.db.patch(r._id, { isDefault: false });
    }
    await ctx.db.patch(args.resumeId, { isDefault: true });
    return { ok: true };
  },
});

export const remove = mutation({
  args: { resumeId: v.id("resumes") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.resumeId);
    return { ok: true };
  },
});
