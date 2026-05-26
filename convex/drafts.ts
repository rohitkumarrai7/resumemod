import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { scoreResumeAgainstJD } from "./atsScoring";
import { parseResumeText, buildSuggestions } from "./resumeParser";

const NON_SKILL_KW = new Set([
  "development", "ai-generated", "modern", "optimization", "improve",
  "technologies", "advanced", "related", "architecture", "design",
  "looking", "join", "company", "opportunity", "position", "apply",
  "prefer", "required", "preferred", "qualifications", "bonus",
  "excellent", "communication", "understanding", "knowledge",
  "familiarity", "proficiency", "proficient", "expertise", "hands-on",
  "environment", "agile", "practices", "methodologies", "approach",
  "solutions", "deliver", "delivering", "building", "creating",
  "maintaining", "ensure", "across", "multiple", "both", "either",
  "based", "focus", "focused", "maintainability", "end",
  "scalable", "production", "integration", "implementation",
  "management", "quality", "best", "standards", "process",
  "processes", "platform", "platforms", "frameworks", "libraries",
  "develop", "developing", "provide", "providing", "support",
  "supporting", "collaborate", "collaborating", "contribute",
  "drive", "driving", "lead", "leading", "ensuring",
  "high", "low", "great", "key", "core",
  "deep", "wide", "full", "true", "real", "able", "available",
  "minimum", "maximum", "ideal", "clear", "simple", "complex",
]);

function generateLatexFromResume(
  resumeText: string,
  jobTitle: string,
  company: string,
  missingKeywords: string[],
  matchedKeywords: string[]
): string {
  const lines = resumeText.split("\n").filter((l) => l.trim());
  let name = "";
  let email = "";
  let phone = "";
  let linkedin = "";
  const sections: { heading: string; lines: string[] }[] = [];
  let currentSection: { heading: string; lines: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[\w\s+.-]+@[\w.-]+\.\w+$/.test(trimmed) && !email) {
      email = trimmed;
      continue;
    }
    if (/^[\+]?[\d\s\-()]{7,}$/.test(trimmed) && !phone && trimmed.length >= 7) {
      phone = trimmed;
      continue;
    }
    if (/linkedin\.com/i.test(trimmed) && !linkedin) {
      linkedin = trimmed;
      continue;
    }
    if (/^(summary|objective|about|profile|professional\s+summary)/i.test(trimmed) && trimmed.length < 50) {
      currentSection = { heading: "Summary", lines: [] };
      sections.push(currentSection);
      continue;
    }
    if (/^(experience|employment|work\s+history|work\s+experience|professional\s+experience)/i.test(trimmed) && trimmed.length < 50) {
      currentSection = { heading: "Experience", lines: [] };
      sections.push(currentSection);
      continue;
    }
    if (/^(education|academic)/i.test(trimmed) && trimmed.length < 50) {
      currentSection = { heading: "Education", lines: [] };
      sections.push(currentSection);
      continue;
    }
    if (/^(skills|technologies|technical\s+skills|competencies)/i.test(trimmed) && trimmed.length < 50) {
      currentSection = { heading: "Skills", lines: [] };
      sections.push(currentSection);
      continue;
    }
    if (/^(projects?|certifications?|awards?|achievements?|publications?|interests?|languages?|volunteer)/i.test(trimmed) && trimmed.length < 50) {
      const heading = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      currentSection = { heading, lines: [] };
      sections.push(currentSection);
      continue;
    }
    if (!name && trimmed.length > 2 && trimmed.length < 60 && /^[A-Z]/.test(trimmed) && !/[@|:;,]/.test(trimmed) && currentSection === null) {
      name = trimmed;
      continue;
    }
    if (currentSection) {
      currentSection.lines.push(trimmed);
    } else {
      currentSection = { heading: "Summary", lines: [trimmed] };
      sections.push(currentSection);
    }
  }

  if (sections.length === 0) {
    sections.push({ heading: "Summary", lines: [resumeText.slice(0, 500)] });
  }

  const skillsSection = sections.find((s) => s.heading === "Skills");
  const allSkills = skillsSection
    ? skillsSection.lines.join(", ").split(/[,&|]/).map((s) => s.trim()).filter((s) => s && !NON_SKILL_KW.has(s.toLowerCase()) && !/^\d+$/.test(s))
    : [];

  const optimizedSkills = [...new Set([...allSkills, ...missingKeywords.filter((kw) => !NON_SKILL_KW.has(kw.toLowerCase())).slice(0, 5)])];

  const escLatex = (s: string) =>
    s.replace(/\\/g, "\\textbackslash{}")
     .replace(/[&%$#_{}]/g, (c) => `\\${c}`)
     .replace(/~/g, "\\textasciitilde{}")
     .replace(/\^/g, "\\textasciicircum{}");

  let latex = `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[margin=0.75in]{geometry}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{xcolor}
\\usepackage{hyperref}

\\definecolor{accent}{HTML}{2563EB}
\\definecolor{heading}{HTML}{1E3A5F}

\\titleformat{\\section}{\\large\\bfseries\\color{heading}}{}{0em}{}[\\titlerule]
\\titlespacing{\\section}{0pt}{8pt}{4pt}

\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{2pt}

\\begin{document}

\\begin{center}
  {\\LARGE\\bfseries ${escLatex(name || "Your Name")}}\\\\[4pt]
  ${[phone, email, linkedin].filter(Boolean).map((s) => `{\\small ${escLatex(s)}}`).join(" $\\cdot$ ")}
\\end{center}

`;

  const summarySection = sections.find((s) => s.heading === "Summary");
  if (summarySection && summarySection.lines.length > 0) {
    latex += `\\section{Professional Summary}\n`;
    latex += summarySection.lines.map((l) => escLatex(l)).join(" ") + "\n\n";
  }

  const expSection = sections.find((s) => s.heading === "Experience");
  if (expSection && expSection.lines.length > 0) {
    latex += `\\section{Experience}\n`;
    latex += `\\begin{itemize}[leftmargin=*,itemsep=2pt]\n`;
    for (const line of expSection.lines) {
      latex += `  \\item ${escLatex(line)}\n`;
    }
    latex += `\\end{itemize}\n\n`;
  }

  const eduSection = sections.find((s) => s.heading === "Education");
  if (eduSection && eduSection.lines.length > 0) {
    latex += `\\section{Education}\n`;
    latex += `\\begin{itemize}[leftmargin=*,itemsep=2pt]\n`;
    for (const line of eduSection.lines) {
      if (/^\d+(\.\d+)?$/.test(line.trim())) continue;
      latex += `  \\item ${escLatex(line)}\n`;
    }
    latex += `\\end{itemize}\n\n`;
  }

  latex += `\\section{Skills}\n`;
  latex += `\\begin{itemize}[leftmargin=*,itemsep=2pt]\n`;
  latex += `  \\item ${optimizedSkills.map((s) => escLatex(s)).join(", ")}\n`;
  latex += `\\end{itemize}\n\n`;

  const otherSections = sections.filter(
    (s) => !["Summary", "Experience", "Education", "Skills"].includes(s.heading)
  );
  for (const sec of otherSections) {
    if (sec.lines.length === 0) continue;
    latex += `\\section{${escLatex(sec.heading)}}\n`;
    latex += `\\begin{itemize}[leftmargin=*,itemsep=2pt]\n`;
    for (const line of sec.lines) {
      latex += `  \\item ${escLatex(line)}\n`;
    }
    latex += `\\end{itemize}\n\n`;
  }

  latex += `\\end{document}\n`;

  return latex;
}

export const create = mutation({
  args: {
    userId: v.id("users"),
    resumeId: v.optional(v.id("resumes")),
    jobTitle: v.optional(v.string()),
    company: v.optional(v.string()),
    jobDescription: v.string(),
    jobUrl: v.optional(v.string()),
    source: v.optional(v.string()),
    location: v.optional(v.string()),
    localScore: v.optional(v.number()),
    localMatched: v.optional(v.array(v.string())),
    localMissing: v.optional(v.array(v.string())),
    localSuggestions: v.optional(v.array(v.any())),
    resumeText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const activeDrafts = await ctx.db
      .query("drafts")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "optimizing")
      )
      .collect();

    const readyDrafts = await ctx.db
      .query("drafts")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "ready")
      )
      .collect();

    const totalActive = activeDrafts.length + readyDrafts.length;
    const limit = 500;
    if (totalActive >= limit) {
      throw new Error(`Draft limit reached (${limit} active). Wait for drafts to expire or upgrade.`);
    }

    let jobId: any = undefined;
    const existingJobs = await ctx.db
      .query("jobs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("pageUrl"), args.jobUrl || ""))
      .first();

    if (existingJobs) {
      jobId = existingJobs._id;
      await ctx.db.patch(jobId, { stage: "tailored", status: "tailored" });
    } else {
      jobId = await ctx.db.insert("jobs", {
        userId: args.userId,
        title: args.jobTitle || "Untitled",
        company: args.company,
        location: args.location,
        description: args.jobDescription,
        pageUrl: args.jobUrl || "",
        source: args.source,
        status: "tailored",
        stage: "tailored",
      });
    }

    const initialScore = args.localScore || 0;

    let resumeText = args.resumeText || "";
    if (!resumeText && args.resumeId) {
      const resume = await ctx.db.get(args.resumeId);
      if (resume) {
        resumeText = resume.rawText || resume.textPreview || "";
      }
    }

    const matchedKw = args.localMatched || [];
    const missingKw = args.localMissing || [];

    const structuredResume = resumeText ? parseResumeText(resumeText) : null;
    const aiSuggestions = structuredResume
      ? buildSuggestions(structuredResume, missingKw, args.localSuggestions || [])
      : [];

    const resumeTextForScore = resumeText || "";
    const atsResult = scoreResumeAgainstJD(resumeTextForScore, args.jobDescription);
    const optimizedScore = atsResult.overallScore;

    const gapAnalysis = {
      missingKeywords: missingKw.slice(0, 10),
      matchedKeywords: matchedKw,
      suggestions: aiSuggestions.map((s) => s.suggestedText),
      optimizedKeywords: [...missingKw.slice(0, 8)].filter((kw) => !matchedKw.includes(kw)),
    };

    const draftId = await ctx.db.insert("drafts", {
      userId: args.userId,
      resumeId: args.resumeId,
      jobId,
      context: {
        jobDescription: args.jobDescription,
        jobTitle: args.jobTitle,
        company: args.company,
        localScore: args.localScore,
        localMatched: matchedKw,
        localMissing: missingKw,
        gapAnalysis,
        resumeOriginalText: resumeText.slice(0, 10000),
        localSuggestions: args.localSuggestions || [],
        structuredResume,
        aiSuggestions,
      },
      originalLatex: "",
      currentLatex: "",
      initialScore: initialScore || atsResult.overallScore,
      currentScore: optimizedScore,
      status: "ready",
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    return {
      draftId,
      status: "ready",
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      estimatedSeconds: 0,
    };
  },
});

export const get = query({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");

    let resume = null;
    if (draft.resumeId) {
      const r = await ctx.db.get(draft.resumeId);
      if (r) resume = { id: r._id, structuredData: r.structuredData, rawText: r.rawText, textPreview: r.textPreview };
    }

    let job = null;
    if (draft.jobId) {
      const j = await ctx.db.get(draft.jobId);
      if (j) {
        job = {
          title: j.title,
          company: j.company,
          description: j.description,
          location: j.location,
          source: j.source,
        };
      }
    }

    const gapAnalysis = (draft.context as any)?.gapAnalysis || {};
    const rawContext = draft.context as any || {};
    return {
      draftId: draft._id,
      status: draft.status,
      context: {
        resume,
        job,
        structuredResume: rawContext.structuredResume || null,
        aiSuggestions: rawContext.aiSuggestions || [],
        analysis: {
          initialScore: draft.initialScore,
          currentScore: draft.currentScore,
          gapAnalysis: {
            ...gapAnalysis,
            resumeOriginalText: rawContext.resumeOriginalText || gapAnalysis.resumeOriginalText || "",
            localSuggestions: rawContext.localSuggestions || [],
          },
        },
        optimization: {
          latexSource: draft.currentLatex,
          changes: rawContext.changes || [],
          predictedScore: draft.currentScore,
        },
      },
      latexSource: draft.currentLatex,
      currentAtsScore: draft.currentScore,
      initialScore: draft.initialScore,
      expiresAt: draft.expiresAt,
      compiledPdfUrl: draft.compiledPdfStorageId ? `/api/drafts/${draft._id}/pdf` : null,
      resumeOriginalText: rawContext.resumeOriginalText || "",
      jobDescription: rawContext.jobDescription || "",
      jobTitle: rawContext.jobTitle || "",
      company: rawContext.company || "",
    };
  },
});

export const compileLatex = mutation({
  args: {
    draftId: v.id("drafts"),
    latexSource: v.string(),
  },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");

    const jd = draft.context?.jobDescription || "";
    let atsResult: any = { overallScore: 0, matchedKeywords: [], missingKeywords: [] };

    if (jd) {
      atsResult = scoreResumeAgainstJD(args.latexSource, jd);
    }

    await ctx.db.patch(args.draftId, {
      currentLatex: args.latexSource,
      currentScore: atsResult.overallScore,
      status: "ready",
    });

    return {
      success: true,
      atsScore: atsResult.overallScore,
      missingKeywords: atsResult.missingKeywords.map((k: any) =>
        typeof k === "string" ? k : k.keyword
      ),
      matchedKeywords: atsResult.matchedKeywords.map((k: any) =>
        typeof k === "string" ? k : k.keyword
      ),
      suggestions: atsResult.suggestions || [],
    };
  },
});

export const updateStructured = mutation({
  args: {
    draftId: v.id("drafts"),
    structuredResume: v.any(),
    aiSuggestions: v.any(),
    currentScore: v.number(),
  },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");
    const ctxData = (draft.context as Record<string, unknown>) || {};
    await ctx.db.patch(args.draftId, {
      currentScore: args.currentScore,
      context: {
        ...ctxData,
        structuredResume: args.structuredResume,
        aiSuggestions: args.aiSuggestions,
      },
    });
    return { ok: true };
  },
});

export const convert = mutation({
  args: {
    draftId: v.id("drafts"),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");

    const versionId = await ctx.db.insert("resumeVersions", {
      userId: draft.userId,
      resumeId: draft.resumeId,
      jobId: draft.jobId,
      draftId: draft._id,
      label: args.label,
      latexSource: draft.currentLatex || "",
      atsScore: draft.currentScore,
      changesLog: draft.context,
    });

    await ctx.db.patch(args.draftId, { status: "converted" });

    return { versionId };
  },
});

export const markReady = mutation({
  args: {
    draftId: v.id("drafts"),
    latexSource: v.string(),
    score: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.draftId, {
      currentLatex: args.latexSource,
      currentScore: args.score,
      status: "ready",
    });
    return { ok: true };
  },
});
