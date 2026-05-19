import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { scoreResumeAgainstJD } from "./atsScoring";

const http = httpRouter();

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

// ─── Health ────────────────────────────────────────────────────────────────────

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return jsonResponse({ status: "ok", version: "2.0.0", backend: "convex" });
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
        return jsonResponse({ detail: "Email, password, and name are required" }, 400);
      }
      const result = await ctx.runMutation(api.auth.register, {
        email: body.email,
        password: body.password,
        name: body.name,
      });
      return jsonResponse(result);
    } catch (e: any) {
      const msg = e.message || "Registration failed";
      const status = msg.includes("already registered") ? 409 : 400;
      return jsonResponse({ detail: msg }, status);
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
        return jsonResponse({ detail: "Email and password are required" }, 400);
      }
      const result = await ctx.runMutation(api.auth.login, {
        email: body.email,
        password: body.password,
      });
      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ detail: e.message || "Invalid email or password" }, 401);
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
      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ detail: e.message }, 401);
    }
  }),
});

http.route({
  path: "/v1/auth/profile",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = extractBearer(request);
      if (!token) return jsonResponse({ detail: "Unauthorized" }, 401);
      const profile = await ctx.runQuery(api.auth.getProfile, { token });
      return jsonResponse(profile);
    } catch (e: any) {
      return jsonResponse({ detail: e.message }, 401);
    }
  }),
});

http.route({
  path: "/v1/auth/logout",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = extractBearer(request);
      if (!token) return jsonResponse({ detail: "Unauthorized" }, 401);
      await ctx.runMutation(api.auth.logout, { token });
      return jsonResponse({ ok: true });
    } catch (e: any) {
      return jsonResponse({ detail: e.message }, 400);
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
      if (!token) return jsonResponse({ detail: "Unauthorized" }, 401);
      const profile = await ctx.runQuery(api.auth.getProfile, { token });
      const resumes = await ctx.runQuery(api.resumes.list, { userId: profile.id as any });
      return jsonResponse({ resumes });
    } catch (e: any) {
      return jsonResponse({ detail: e.message }, 401);
    }
  }),
});

http.route({
  path: "/v1/resumes/upload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = extractBearer(request);
      if (!token) return jsonResponse({ detail: "Unauthorized" }, 401);
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

      return jsonResponse({ id: resumeId, ok: true });
    } catch (e: any) {
      return jsonResponse({ detail: e.message }, 400);
    }
  }),
});

http.route({
  path: "/v1/resumes/{resumeId}",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = extractBearer(request);
      if (!token) return jsonResponse({ detail: "Unauthorized" }, 401);
      const resumeId = extractPathParam(request.url, "resumes") as any;
      await ctx.runMutation(api.resumes.remove, { resumeId });
      return jsonResponse({ ok: true });
    } catch (e: any) {
      return jsonResponse({ detail: e.message }, 400);
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
      if (!token) return jsonResponse({ detail: "Unauthorized" }, 401);
      const profile = await ctx.runQuery(api.auth.getProfile, { token });
      const url = new URL(request.url);
      const status = url.searchParams.get("status") || undefined;
      const source = url.searchParams.get("source") || undefined;
      const jobs = await ctx.runQuery(api.jobs.list, {
        userId: profile.id as any,
        status,
        source,
      });
      return jsonResponse({ jobs });
    } catch (e: any) {
      return jsonResponse({ detail: e.message }, 401);
    }
  }),
});

http.route({
  path: "/v1/jobs",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = extractBearer(request);
      if (!token) return jsonResponse({ detail: "Unauthorized" }, 401);
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
      });
      return jsonResponse({ id: jobId, ok: true });
    } catch (e: any) {
      return jsonResponse({ detail: e.message }, 400);
    }
  }),
});

http.route({
  path: "/v1/jobs/{jobId}",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = extractBearer(request);
      if (!token) return jsonResponse({ detail: "Unauthorized" }, 401);
      const body = await request.json();
      const jobId = extractPathParam(request.url, "jobs") as any;
      await ctx.runMutation(api.jobs.updateStatus, { jobId, status: body.status, notes: body.notes });
      return jsonResponse({ ok: true });
    } catch (e: any) {
      return jsonResponse({ detail: e.message }, 400);
    }
  }),
});

http.route({
  path: "/v1/jobs/{jobId}",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = extractBearer(request);
      if (!token) return jsonResponse({ detail: "Unauthorized" }, 401);
      const jobId = extractPathParam(request.url, "jobs") as any;
      await ctx.runMutation(api.jobs.remove, { jobId });
      return jsonResponse({ ok: true });
    } catch (e: any) {
      return jsonResponse({ detail: e.message }, 400);
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

      return jsonResponse({
        draftId: result.draftId,
        editorUrl: `${baseEditorUrl}/editor?draft=${result.draftId}`,
        status: "optimizing",
        expiresAt: result.expiresAt,
        estimatedSeconds: result.estimatedSeconds,
      });
    } catch (e: any) {
      return jsonResponse({ detail: e.message }, 400);
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
      return jsonResponse(draft);
    } catch (e: any) {
      return jsonResponse({ detail: e.message }, 404);
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
      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ detail: e.message }, 400);
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
      return jsonResponse(result);
    } catch (e: any) {
      return jsonResponse({ detail: e.message }, 400);
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

      return jsonResponse({
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
      return jsonResponse({ detail: e.message }, 400);
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

// ─── PDF Parse ─────────────────────────────────────────────────────────────────

http.route({
  path: "/v1/pdf/parse",
  method: "POST",
  handler: httpAction(async (_, request) => {
    try {
      const body = await request.json();
      const base64 = body.base64 || "";

      if (!base64) {
        return jsonResponse({ error: "Missing base64 data" }, 400);
      }

      const base64Data = base64.replace(/^data:application\/pdf;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const pdfParse = require("pdf-parse");
      const pdfData = await pdfParse(buffer);
      const fullText = pdfData.text || "";

      return jsonResponse({ text: fullText });
    } catch (error: any) {
      console.error("PDF parse error:", error);
      return jsonResponse({ text: "", error: error.message });
    }
  }),
});

// ─── CORS Preflight ────────────────────────────────────────────────────────────

const CORS_HANDLER = httpAction(async (_, request) => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
});

for (const path of [
  "/v1/auth/register", "/v1/auth/login", "/v1/auth/refresh",
  "/v1/auth/profile", "/v1/auth/logout",
  "/v1/resumes", "/v1/resumes/upload",
  "/v1/drafts/create",
  "/v1/ats/analyze",
  "/v1/pdf/parse",
]) {
  http.route({ path, method: "OPTIONS", handler: CORS_HANDLER });
}

// Dynamic routes need pathPrefix for OPTIONS to work
http.route({ pathPrefix: "/v1/resumes/", method: "OPTIONS", handler: CORS_HANDLER });
http.route({ pathPrefix: "/v1/jobs/", method: "OPTIONS", handler: CORS_HANDLER });
http.route({ pathPrefix: "/v1/drafts/", method: "OPTIONS", handler: CORS_HANDLER });
http.route({ pathPrefix: "/v1/pdf/", method: "OPTIONS", handler: CORS_HANDLER });

export default http;
