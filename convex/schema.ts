import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    hashedPassword: v.optional(v.string()),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    tier: v.string(),
    googleId: v.optional(v.string()),
    linkedinId: v.optional(v.string()),
    analysesCount: v.number(),
    compilationsCount: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_tier", ["tier"]),

  resumes: defineTable({
    userId: v.id("users"),
    filename: v.string(),
    mimeType: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    fileSize: v.optional(v.number()),
    textPreview: v.optional(v.string()),
    structuredData: v.optional(v.any()),
    rawText: v.optional(v.string()),
    label: v.string(),
    isDefault: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_default", ["userId", "isDefault"]),

  jobs: defineTable({
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
    structuredRequirements: v.optional(v.any()),
    status: v.string(),
    appliedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_source", ["userId", "source"]),

  drafts: defineTable({
    userId: v.id("users"),
    resumeId: v.optional(v.id("resumes")),
    jobId: v.optional(v.id("jobs")),
    context: v.any(),
    originalLatex: v.optional(v.string()),
    currentLatex: v.optional(v.string()),
    compiledPdfStorageId: v.optional(v.id("_storage")),
    initialScore: v.optional(v.number()),
    currentScore: v.optional(v.number()),
    status: v.string(),
    expiresAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),

  resumeVersions: defineTable({
    userId: v.id("users"),
    resumeId: v.optional(v.id("resumes")),
    jobId: v.optional(v.id("jobs")),
    draftId: v.optional(v.id("drafts")),
    label: v.string(),
    latexSource: v.string(),
    compiledPdfStorageId: v.optional(v.id("_storage")),
    atsScore: v.optional(v.number()),
    changesLog: v.optional(v.any()),
  }).index("by_user", ["userId"]),

  atsAnalyses: defineTable({
    userId: v.id("users"),
    resumeVersionId: v.optional(v.id("resumeVersions")),
    jobId: v.optional(v.id("jobs")),
    overallScore: v.number(),
    keywordMatchScore: v.optional(v.number()),
    semanticScore: v.optional(v.number()),
    sectionScore: v.optional(v.number()),
    formatScore: v.optional(v.number()),
    matchedKeywords: v.optional(v.any()),
    missingKeywords: v.optional(v.any()),
    suggestions: v.optional(v.any()),
  }).index("by_user", ["userId"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_refresh", ["refreshToken"])
    .index("by_user", ["userId"]),
});
