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
    clerkId: v.optional(v.string()),
    linkedinId: v.optional(v.string()),
    analysesCount: v.number(),
    compilationsCount: v.number(),
    tailorsThisMonth: v.optional(v.number()),
    tailorsResetAt: v.optional(v.number()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    razorpayCustomerId: v.optional(v.string()),
    razorpaySubscriptionId: v.optional(v.string()),
    onboardingCompleted: v.optional(v.boolean()),
  })
    .index("by_email", ["email"])
    .index("by_clerk", ["clerkId"])
    .index("by_tier", ["tier"])
    .index("by_stripe_customer", ["stripeCustomerId"])
    .index("by_razorpay_customer", ["razorpayCustomerId"]),

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
    profileRole: v.optional(v.string()),
    sections: v.optional(v.any()),
    lastAtsScore: v.optional(v.number()),
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
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    deadline: v.optional(v.number()),
    stage: v.optional(v.string()),
    atsScore: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_source", ["userId", "source"])
    .index("by_user_stage", ["userId", "stage"]),

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
    structuredJson: v.optional(v.any()),
    compiledPdfStorageId: v.optional(v.id("_storage")),
    atsScore: v.optional(v.number()),
    changesLog: v.optional(v.any()),
    templateId: v.optional(v.string()),
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

  // ─── New tables for SaaS features ───────────────────────────────────────────

  tailoringRuns: defineTable({
    userId: v.id("users"),
    resumeId: v.optional(v.id("resumes")),
    jobId: v.optional(v.id("jobs")),
    status: v.string(),
    provider: v.optional(v.string()),
    scoreBefore: v.number(),
    scoreAfter: v.optional(v.number()),
    suggestions: v.optional(v.any()),
    latexSource: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),

  templates: defineTable({
    name: v.string(),
    slug: v.string(),
    category: v.string(),
    engine: v.string(),
    thumbnail: v.optional(v.string()),
    colors: v.optional(v.array(v.string())),
    fonts: v.optional(v.array(v.string())),
    spacing: v.optional(v.string()),
    sectionOrder: v.optional(v.array(v.string())),
    latexTemplate: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_slug", ["slug"])
    .index("by_category", ["category"]),

  coverLetters: defineTable({
    userId: v.id("users"),
    jobId: v.optional(v.id("jobs")),
    resumeVersionId: v.optional(v.id("resumeVersions")),
    tone: v.string(),
    content: v.string(),
    status: v.string(),
  }).index("by_user", ["userId"]),

  exports: defineTable({
    userId: v.id("users"),
    resumeVersionId: v.optional(v.id("resumeVersions")),
    format: v.string(),
    storageId: v.optional(v.id("_storage")),
    status: v.string(),
    error: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_version", ["resumeVersionId"]),

  usageEvents: defineTable({
    userId: v.id("users"),
    type: v.string(),
    metadata: v.optional(v.any()),
  }).index("by_user", ["userId"]),

  payments: defineTable({
    userId: v.id("users"),
    razorpayPaymentId: v.string(),
    razorpayOrderId: v.optional(v.string()),
    tier: v.string(),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    status: v.string(),
    createdAt: v.number(),
  })
    .index("by_razorpay_payment", ["razorpayPaymentId"])
    .index("by_user", ["userId"]),
});
