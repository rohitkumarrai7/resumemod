// ─── Shared product contracts ──────────────────────────────────────────────────
// Used across web app, extension, and Convex API boundaries.

export interface JobPosting {
  title: string;
  company: string;
  location?: string;
  description: string;
  salary?: string;
  employmentType?: string;
  skills?: string[];
  applyUrl?: string;
  pageUrl: string;
  source?: string;
}

export interface ResumeProfile {
  id: string;
  userId: string;
  label: string;
  role: string;
  isDefault: boolean;
  sections: ResumeSection[];
  rawText?: string;
  filename?: string;
  mimeType?: string;
  createdAt: number;
}

export interface ResumeSection {
  id: string;
  type: "summary" | "experience" | "education" | "skills" | "projects" | "certifications" | "achievements" | "custom";
  heading: string;
  items: ResumeBullet[];
  order: number;
}

export interface ResumeBullet {
  id: string;
  text: string;
  metadata?: {
    company?: string;
    role?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
    degree?: string;
    institution?: string;
  };
}

export interface TailoringRun {
  id: string;
  userId: string;
  resumeProfileId: string;
  jobId: string;
  status: "pending" | "running" | "completed" | "failed";
  provider?: string;
  scoreBefore: number;
  scoreAfter?: number;
  suggestions: TailoringSuggestion[];
  latexSource?: string;
  createdAt: number;
  completedAt?: number;
  latencyMs?: number;
}

export interface TailoringSuggestion {
  id: string;
  sectionId: string;
  bulletId?: string;
  type: "rewrite" | "add" | "remove" | "reorder";
  originalText: string;
  suggestedText: string;
  reason: string;
  keywords: string[];
  applied: boolean;
}

export interface TemplateConfig {
  id: string;
  name: string;
  category: "ats" | "design";
  engine: "react-pdf" | "latex" | "html-to-pdf";
  thumbnail?: string;
  styles: {
    colors: string[];
    fonts: string[];
    spacing: "compact" | "normal" | "spacious";
  };
  sectionOrder: string[];
}

export interface ExportArtifact {
  id: string;
  userId: string;
  resumeVersionId: string;
  format: "pdf" | "docx" | "latex";
  storageId?: string;
  url?: string;
  status: "pending" | "ready" | "failed";
  error?: string;
  createdAt: number;
}

export interface CoverLetter {
  id: string;
  userId: string;
  jobId: string;
  resumeVersionId?: string;
  tone: "concise" | "confident" | "technical" | "warm";
  content: string;
  status: "draft" | "final";
  createdAt: number;
}

export interface ApplicationStatus {
  id: string;
  userId: string;
  jobId: string;
  stage: "wishlist" | "tailored" | "applied" | "screening" | "interview" | "offer" | "rejected";
  resumeVersionId?: string;
  coverLetterId?: string;
  notes?: string;
  contactName?: string;
  contactEmail?: string;
  appliedAt?: number;
  deadline?: number;
  salary?: string;
  updatedAt: number;
}

export interface ATSAnalysis {
  overallScore: number;
  keywordMatchScore: number;
  semanticScore: number;
  sectionScore: number;
  formatScore: number;
  matchedKeywords: KeywordMatch[];
  missingKeywords: KeywordMatch[];
  suggestions: string[];
}

export interface KeywordMatch {
  keyword: string;
  category: "hard_skill" | "soft_skill" | "tool" | "domain" | "responsibility";
  weight: number;
  matchType?: "exact" | "semantic" | "missing";
}

export type PricingTier = "free" | "pro" | "premium";

export interface TierLimits {
  tailorsPerMonth: number;
  maxResumes: number;
  coverLetters: boolean;
  pdfExport: boolean;
  docxExport: boolean;
  interviewPrep: boolean;
  autofill: boolean;
  advancedAnalytics: boolean;
}

export const TIER_LIMITS: Record<PricingTier, TierLimits> = {
  free: {
    tailorsPerMonth: 5,
    maxResumes: 3,
    coverLetters: false,
    pdfExport: true,
    docxExport: false,
    interviewPrep: false,
    autofill: false,
    advancedAnalytics: false,
  },
  pro: {
    tailorsPerMonth: 100,
    maxResumes: 20,
    coverLetters: true,
    pdfExport: true,
    docxExport: true,
    interviewPrep: true,
    autofill: false,
    advancedAnalytics: false,
  },
  premium: {
    tailorsPerMonth: -1,
    maxResumes: -1,
    coverLetters: true,
    pdfExport: true,
    docxExport: true,
    interviewPrep: true,
    autofill: true,
    advancedAnalytics: true,
  },
};
