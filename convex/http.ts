import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { scoreResumeAgainstJD } from "./atsScoring";

const http = httpRouter();
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://resumod.vercel.app",
];

function getAllowedOrigin(request: Request): string {
  const origin = request.headers.get("Origin") || "";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.startsWith("chrome-extension://")) return origin;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  if (/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

function jsonResponse(request: Request, data: unknown, status = 200) {
  const origin = getAllowedOrigin(request);
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Vary": "Origin",
    },
  });
}

function extractBearer(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

/**
 * Extract a path segment by name from the URL.
 * For a URL like /v1/drafts/abc123/compile and segmentName "drafts",
 * it returns "abc123" (the segment AFTER the named one).
 */
function extractPathParam(url: string, segmentName: string): string {
  const parts = new URL(url).pathname.split("/");
  const idx = parts.indexOf(segmentName);
  if (idx >= 0 && idx + 1 < parts.length) {
    return parts[idx + 1];
  }
  // Fallback: return last segment
  return parts[parts.length - 1];
}

function isResumeItemPath(url: string): boolean {
  const path = new URL(url).pathname;
  if (!path.startsWith("/v1/resumes/")) return false;
  const rest = path.slice("/v1/resumes/".length);
  return rest.length > 0 && rest !== "upload";
}

// ─── Health ────────────────────────────────────────────────────────────────────

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    return jsonResponse(request, { status: "ok", version: "2.0.0", backend: "convex" });
  }),
});

// ─── Auth ──────────────────────────────────────────────────────────────────────

http.route({
  path: "/v1/auth/register",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      if (!body.email || !body.password || !body.name) {
        return jsonResponse(request, { detail: "Email, password, and name are required" }, 400);
      }
      const result = await ctx.runMutation(api.auth.register, {
        email: body.email,
        password: body.password,
        name: body.name,
      });
      return jsonResponse(request, result);
    } catch (e: any) {
      const msg = e.message || "Registration failed";
      const status = msg.includes("already registered") ? 409 : 400;
      return jsonResponse(request, { detail: msg }, status);
    }
  }),
});

http.route({
  path: "/v1/auth/login",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      if (!body.email || !body.password) {
        return jsonResponse(request, { detail: "Email and password are required" }, 400);
      }
      const result = await ctx.runMutation(api.auth.login, {
        email: body.email,
        password: body.password,
      });
      return jsonResponse(request, result);
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message || "Invalid email or password" }, 401);
    }
  }),
});

http.route({
  path: "/v1/auth/refresh",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const result = await ctx.runMutation(api.auth.refreshToken, {
        refreshToken: body.refreshToken,
      });
      return jsonResponse(request, result);
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message }, 401);
    }
  }),
});

http.route({
  path: "/v1/auth/profile",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = extractBearer(request);
      if (!token) return jsonResponse(request, { detail: "Unauthorized" }, 401);
      const profile = await ctx.runQuery(api.auth.getProfile, { token });
      return jsonResponse(request, profile);
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message }, 401);
    }
  }),
});

http.route({
  path: "/v1/auth/logout",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = extractBearer(request);
      if (!token) return jsonResponse(request, { detail: "Unauthorized" }, 401);
      await ctx.runMutation(api.auth.logout, { token });
      return jsonResponse(request, { ok: true });
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message }, 400);
    }
  }),
});


http.route({
  path: "/v1/auth/onboarding/complete",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = extractBearer(request);
      if (!token) return jsonResponse(request, { detail: "Unauthorized" }, 401);
      await ctx.runMutation(api.auth.completeOnboarding, { token });
      return jsonResponse(request, { ok: true });
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message || "Unauthorized" }, 401);
    }
  }),
});

http.route({
  path: "/v1/auth/clerk-sync",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      if (!body.syncSecret || !body.clerkId || !body.email) {
        return jsonResponse(request, { detail: "Missing required fields" }, 400);
      }
      const result = await ctx.runMutation(api.auth.clerkSync, {
        syncSecret: body.syncSecret,
        clerkId: body.clerkId,
        email: body.email,
        name: body.name,
      });
      return jsonResponse(request, result);
    } catch (e: any) {
      const status = e.message === "Unauthorized" ? 401 : 400;
      return jsonResponse(request, { detail: e.message || "Clerk sync failed" }, status);
    }
  }),
});

// ─── Resumes ───────────────────────────────────────────────────────────────────

http.route({
  path: "/v1/resumes",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = extractBearer(request);
      if (!token) return jsonResponse(request, { detail: "Unauthorized" }, 401);
      const profile = await ctx.runQuery(api.auth.getProfile, { token });
      const resumes = await ctx.runQuery(api.resumes.list, { userId: profile.id as any });
      return jsonResponse(request, { resumes });
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message }, 401);
    }
  }),
});

http.route({
  path: "/v1/resumes/upload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = extractBearer(request);
      if (!token) return jsonResponse(request, { detail: "Unauthorized" }, 401);
      const profile = await ctx.runQuery(api.auth.getProfile, { token });
      const body = await request.json();

      const resumeId = await ctx.runMutation(api.resumes.upload, {
        userId: profile.id as any,
        filename: body.filename || "resume.pdf",
        mimeType: body.mimeType,
        fileSize: body.fileSize,
        textPreview: body.textPreview,
        rawText: body.rawText,
        structuredData: body.structuredData,
        label: body.label,
      });

      return jsonResponse(request, { id: resumeId, ok: true });
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message }, 400);
    }
  }),
});

http.route({
  pathPrefix: "/v1/resumes/",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    if (!isResumeItemPath(request.url)) {
      return jsonResponse(request, { detail: "Not found" }, 404);
    }
    try {
      const token = extractBearer(request);
      if (!token) return jsonResponse(request, { detail: "Unauthorized" }, 401);
      const profile = await ctx.runQuery(api.auth.getProfile, { token });
      const body = await request.json();
      const resumeId = extractPathParam(request.url, "resumes") as any;

      await ctx.runMutation(api.resumes.update, {
        resumeId,
        userId: profile.id as any,
        label: body.label,
        profileRole: body.profileRole,
        lastAtsScore: body.lastAtsScore,
      });

      if (body.setDefault) {
        await ctx.runMutation(api.resumes.setDefault, {
          resumeId,
          userId: profile.id as any,
        });
      }

      return jsonResponse(request, { ok: true });
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message }, 400);
    }
  }),
});

http.route({
  pathPrefix: "/v1/resumes/",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    if (!isResumeItemPath(request.url)) {
      return jsonResponse(request, { detail: "Not found" }, 404);
    }
    try {
      const token = extractBearer(request);
      if (!token) return jsonResponse(request, { detail: "Unauthorized" }, 401);
      const profile = await ctx.runQuery(api.auth.getProfile, { token });
      const resumeId = extractPathParam(request.url, "resumes") as any;
      await ctx.runMutation(api.resumes.remove, {
        resumeId,
        userId: profile.id as any,
      });
      return jsonResponse(request, { ok: true });
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message }, 400);
    }
  }),
});

// ─── Jobs ──────────────────────────────────────────────────────────────────────

http.route({
  path: "/v1/jobs",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = extractBearer(request);
      if (!token) return jsonResponse(request, { detail: "Unauthorized" }, 401);
      const profile = await ctx.runQuery(api.auth.getProfile, { token });
      const url = new URL(request.url);
      const status = url.searchParams.get("status") || undefined;
      const source = url.searchParams.get("source") || undefined;
      const jobs = await ctx.runQuery(api.jobs.list, {
        userId: profile.id as any,
        status,
        source,
      });
      return jsonResponse(request, { jobs });
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message }, 401);
    }
  }),
});

http.route({
  path: "/v1/jobs",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = extractBearer(request);
      if (!token) return jsonResponse(request, { detail: "Unauthorized" }, 401);
      const profile = await ctx.runQuery(api.auth.getProfile, { token });
      const body = await request.json();
      const jobId = await ctx.runMutation(api.jobs.save, {
        userId: profile.id as any,
        title: body.title,
        company: body.company,
        location: body.location,
        description: body.description,
        salary: body.salary,
        employmentType: body.employmentType,
        skills: body.skills,
        applyUrl: body.applyUrl,
        pageUrl: body.pageUrl,
        source: body.source,
        atsScore: body.atsScore,
      });
      return jsonResponse(request, { id: jobId, ok: true });
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message }, 400);
    }
  }),
});

http.route({
  pathPrefix: "/v1/jobs/",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = extractBearer(request);
      if (!token) return jsonResponse(request, { detail: "Unauthorized" }, 401);
      const body = await request.json();
      const jobId = extractPathParam(request.url, "jobs") as any;
      await ctx.runMutation(api.jobs.updateStatus, {
        jobId,
        status: body.status,
        stage: body.stage,
        notes: body.notes,
      });
      return jsonResponse(request, { ok: true });
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message }, 400);
    }
  }),
});

http.route({
  pathPrefix: "/v1/jobs/",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = extractBearer(request);
      if (!token) return jsonResponse(request, { detail: "Unauthorized" }, 401);
      const jobId = extractPathParam(request.url, "jobs") as any;
      await ctx.runMutation(api.jobs.remove, { jobId });
      return jsonResponse(request, { ok: true });
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message }, 400);
    }
  }),
});

// ─── Drafts ────────────────────────────────────────────────────────────────────

http.route({
  path: "/v1/drafts/create",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = extractBearer(request);
      let userId: any;

      if (token) {
        try {
          const profile = await ctx.runQuery(api.auth.getProfile, { token });
          userId = profile.id as any;
        } catch (e) {
          userId = await ctx.runMutation(api.auth.getOrCreateAnonUser, {});
        }
      } else {
        userId = await ctx.runMutation(api.auth.getOrCreateAnonUser, {});
      }
      const body = await request.json();

      const resumeText = body.resumeText || body.resumeBase64 || "";
      const atsResult = scoreResumeAgainstJD(resumeText, body.jobDescription);

      const localAnalysis = body.localAnalysis || {};
      const localScore = localAnalysis.score || atsResult.overallScore;
      const localMatched = localAnalysis.matchedKeywords || atsResult.matchedKeywords.map((k: any) => k.keyword);
      const localMissing = localAnalysis.missingKeywords || atsResult.missingKeywords.map((k: any) => k.keyword);
      const localSuggestions = localAnalysis.suggestions || [];

      const result = await ctx.runMutation(api.drafts.create, {
        userId: userId as any,
        jobTitle: body.jobTitle,
        company: body.company,
        jobDescription: body.jobDescription,
        jobUrl: body.jobUrl,
        source: body.source,
        location: body.location,
        localScore,
        localMatched,
        localMissing,
        localSuggestions,
        resumeText,
      });

      const baseEditorUrl = "http://localhost:3000";

      return jsonResponse(request, {
        draftId: result.draftId,
        editorUrl: `${baseEditorUrl}/editor?draft=${result.draftId}`,
        status: "optimizing",
        expiresAt: result.expiresAt,
        estimatedSeconds: result.estimatedSeconds,
      });
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message }, 400);
    }
  }),
});

http.route({
  pathPrefix: "/v1/drafts/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      // Draft ID itself serves as the access key (unguessable random ID)
      const draftId = extractPathParam(request.url, "drafts") as any;
      const draft = await ctx.runQuery(api.drafts.get, { draftId });
      return jsonResponse(request, draft);
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message }, 404);
    }
  }),
});

http.route({
  pathPrefix: "/v1/drafts/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const draftId = extractPathParam(request.url, "drafts") as any;
      const result = await ctx.runMutation(api.drafts.compileLatex, {
        draftId,
        latexSource: body.latexSource,
      });
      return jsonResponse(request, result);
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message }, 400);
    }
  }),
});

http.route({
  pathPrefix: "/v1/drafts/",
  method: "PUT", // changed to PUT since both compile and convert would conflict on POST if using the same prefix
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const draftId = extractPathParam(request.url, "drafts") as any;
      const result = await ctx.runMutation(api.drafts.convert, {
        draftId,
        label: body.label,
      });
      return jsonResponse(request, result);
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message }, 400);
    }
  }),
});

// ─── ATS Analysis ──────────────────────────────────────────────────────────────

http.route({
  path: "/v1/ats/analyze",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const result = scoreResumeAgainstJD(body.resumeText || "", body.jobDescription || "");

      const resumeText = body.resumeText || "";
      const secScore = sectionCompletenessScore(resumeText);

      return jsonResponse(request, {
        score: result.overallScore,
        maxPossibleScore: 100,
        breakdown: {
          keywordMatch: result.matchedKeywords.length,
          semanticSimilarity: 0,
          sectionCompleteness: Math.round(secScore * 100),
          formatCompatibility: 85,
        },
        matchedKeywords: result.matchedKeywords,
        missingKeywords: result.missingKeywords,
        suggestions: result.suggestions,
        estimatedAtsPassRate: result.overallScore >= 75 ? "high" : result.overallScore >= 50 ? "medium" : "low",
      });
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message }, 400);
    }
  }),
});

function sectionCompletenessScore(text: string): number {
  const patterns = [
    /(phone|email|linkedin|@)/i,
    /(summary|objective|about|profile)/i,
    /(experience|employment|work history)/i,
    /(education|degree|university|college)/i,
    /(skills|technologies|competencies)/i,
  ];
  let found = 0;
  for (const p of patterns) if (p.test(text)) found++;
  return found / patterns.length;
}

// ─── AI Generate ──────────────────────────────────────────────────────────────

http.route({
  path: "/v1/ai/generate",
  method: "POST",
  handler: httpAction(async (_, request) => {
    try {
      const body = await request.json();
      const messages = body.messages || [];
      const maxTokens = body.maxTokens || 4096;

      const apiKey = (globalThis as any).process?.env?.OPENAI_API_KEY || "";
      if (!apiKey) {
        return jsonResponse(request, 
          { error: "AI service not configured. Set OPENAI_API_KEY in Convex env.", content: "" },
          503
        );
      }

      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          max_tokens: maxTokens,
          temperature: 0.3,
        }),
      });

      if (!openaiRes.ok) {
        const errBody = await openaiRes.text().catch(() => "");
        console.error("OpenAI API error:", openaiRes.status, errBody);
        return jsonResponse(request, 
          { error: `OpenAI API error: ${openaiRes.status}`, content: "" },
          502
        );
      }

      const data = await openaiRes.json();
      const content = data.choices?.[0]?.message?.content || "";
      return jsonResponse(request, { content, usage: data.usage });
    } catch (error: any) {
      console.error("AI generate error:", error);
      return jsonResponse(request, { error: error.message, content: "" }, 500);
    }
  }),
});

// ─── Billing (Razorpay) ────────────────────────────────────────────────────────

http.route({
  path: "/v1/billing/razorpay",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      if (!body.internalSecret || !body.tier || !body.razorpayPaymentId) {
        return jsonResponse(request, { detail: "Missing required fields" }, 400);
      }
      const result = await ctx.runMutation(api.billing.updateTierFromPayment, {
        internalSecret: body.internalSecret,
        clerkId: body.clerkId,
        userId: body.userId,
        email: body.email,
        tier: body.tier,
        razorpayPaymentId: body.razorpayPaymentId,
        razorpayOrderId: body.razorpayOrderId,
        razorpaySubscriptionId: body.razorpaySubscriptionId,
        amount: body.amount,
        currency: body.currency,
      });
      return jsonResponse(request, result);
    } catch (e: any) {
      const status = e.message === "Unauthorized" ? 401 : 400;
      return jsonResponse(request, { detail: e.message || "Billing sync failed" }, status);
    }
  }),
});

// ─── Templates ─────────────────────────────────────────────────────────────────

http.route({
  path: "/v1/templates",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const category = url.searchParams.get("category") || undefined;
      const templates = await ctx.runQuery(api.templates.list, { category });
      return jsonResponse(request, { templates });
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message || "Failed to list templates" }, 400);
    }
  }),
});

http.route({
  path: "/v1/templates/seed",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const result = await ctx.runMutation(api.templates.seed, {});
      return jsonResponse(request, result);
    } catch (e: any) {
      return jsonResponse(request, { detail: e.message || "Failed to seed templates" }, 400);
    }
  }),
});

// ─── PDF Parse ─────────────────────────────────────────────────────────────────

http.route({
  path: "/v1/pdf/parse",
  method: "POST",
  handler: httpAction(async (_, request) => {
    try {
      const body = await request.json();
      const base64 = body.base64 || "";

      if (!base64) {
        return jsonResponse(request, { error: "Missing base64 data" }, 400);
      }

      const base64Data = base64.replace(/^data:application\/pdf;base64,/, "");
      const decoded = atob(base64Data);

      const parenStrings: string[] = [];
      const parenRegex = /\(([^)]{2,})\)/g;
      let match;
      while ((match = parenRegex.exec(decoded)) !== null) {
        const str = match[1]
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\\(/g, "(")
          .replace(/\\\)/g, ")")
          .replace(/\\\\/g, "\\");
        if (/^[0-9a-fA-F\s]+$/.test(str)) continue;
        if (str.length >= 3) parenStrings.push(str);
      }

      const btBlocks = decoded.match(/BT[\s\S]*?ET/g) || [];
      const btText: string[] = [];
      for (const block of btBlocks) {
        const tjMatches = block.match(/\[([^\]]+)\]\s*T[Jj]/g) || [];
        for (const m of tjMatches) {
          const inner = m.replace(/\]\s*T[Jj]/, "").replace(/^\[/, "");
          const parts = inner.match(/\(([^)]+)\)/g) || [];
          for (const p of parts) {
            const s = p.slice(1, -1)
              .replace(/\\n/g, "\n")
              .replace(/\\r/g, "\r")
              .replace(/\\t/g, "\t")
              .replace(/\\\(/g, "(")
              .replace(/\\\)/g, ")")
              .replace(/\\\\/g, "\\");
            if (s.length >= 2) btText.push(s);
          }
        }
      }

      const allText = [...parenStrings, ...btText].join(" ").replace(/\s+/g, " ").trim();

      if (allText.length > 50) {
        console.log("PDF parse success (basic extraction):", allText.length, "chars");
        return jsonResponse(request, { text: allText });
      }

      return jsonResponse(request, { text: "", error: "No extractable text found in PDF" });
    } catch (error: any) {
      console.error("PDF parse error:", error);
      return jsonResponse(request, { text: "", error: error.message });
    }
  }),
});

// ─── CORS Preflight ────────────────────────────────────────────────────────────

const CORS_HANDLER = httpAction(async (_, request) => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": getAllowedOrigin(request),
      "Vary": "Origin",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
});

for (const path of [
  "/v1/auth/register", "/v1/auth/login", "/v1/auth/refresh",
  "/v1/auth/profile", "/v1/auth/logout", "/v1/auth/onboarding/complete", "/v1/auth/clerk-sync",
  "/v1/resumes", "/v1/resumes/upload",
  "/v1/jobs",
  "/v1/drafts/create",
  "/v1/ats/analyze",
  "/v1/pdf/parse",
  "/v1/ai/generate",
  "/v1/templates", "/v1/templates/seed",
]) {
  http.route({ path, method: "OPTIONS", handler: CORS_HANDLER });
}

// Dynamic routes need pathPrefix for OPTIONS to work
http.route({ pathPrefix: "/v1/resumes/", method: "OPTIONS", handler: CORS_HANDLER });
http.route({ pathPrefix: "/v1/jobs/", method: "OPTIONS", handler: CORS_HANDLER });
http.route({ pathPrefix: "/v1/drafts/", method: "OPTIONS", handler: CORS_HANDLER });
http.route({ pathPrefix: "/v1/pdf/", method: "OPTIONS", handler: CORS_HANDLER });

export default http;
