import { parseResumeText } from "./resumeParser";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://canny-woodpecker-211.convex.site";

export interface User {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  onboardingCompleted?: boolean;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rf_access_token");
}

function setTokens(access: string, refresh: string) {
  localStorage.setItem("rf_access_token", access);
  localStorage.setItem("rf_refresh_token", refresh);
}

function clearTokens() {
  localStorage.removeItem("rf_access_token");
  localStorage.removeItem("rf_refresh_token");
  localStorage.removeItem("rf_user");
}

function setUser(user: User) {
  localStorage.setItem("rf_user", JSON.stringify(user));
}

function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("rf_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const proxyPath = path.startsWith("/") ? path.slice(1) : path;
  let res: Response;
  try {
    res = await fetch(`/api/convex/${proxyPath}`, { ...options, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    if (msg === "Failed to fetch") {
      if (!getToken()) {
        throw new Error("Not signed in. Please sign in again at /login.");
      }
      throw new Error("Could not reach the server. Try refreshing the page.");
    }
    throw new Error(msg);
  }
  if (res.status === 401 && token) {
    const refreshed = await refreshToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${getToken()}`;
      return fetch(`/api/convex/${proxyPath}`, { ...options, headers });
    }
    clearTokens();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }
  return res;
}

async function refreshToken(): Promise<boolean> {
  const refresh = localStorage.getItem("rf_refresh_token");
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_URL}/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.access, data.refresh);
    return true;
  } catch { return false; }
}

export const api = {
  auth: {
    register: async (email: string, password: string, name: string) => {
      const res = await fetch(`${API_URL}/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Registration failed" }));
        throw new Error(err.detail || "Registration failed");
      }
      const data = await res.json();
      setTokens(data.tokens.access, data.tokens.refresh);
      setUser(data.user);
      return data.user;
    },
    login: async (email: string, password: string) => {
      const res = await fetch(`${API_URL}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Login failed" }));
        throw new Error(err.detail || "Login failed");
      }
      const data = await res.json();
      setTokens(data.tokens.access, data.tokens.refresh);
      setUser(data.user);
      return data.user;
    },
    logout: async () => {
      const token = getToken();
      if (token) {
        try {
          await fetch(`${API_URL}/v1/auth/logout`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          });
        } catch { /* ignore network errors on logout */ }
      }
      clearTokens();
    },
    getUser: () => getStoredUser(),
    isLoggedIn: () => !!getToken(),
    getProfile: async () => {
      const res = await apiFetch("/v1/auth/profile");
      if (!res.ok) throw new Error("Failed to fetch profile");
      const profile = await res.json();
      const stored = getStoredUser();
      if (stored) {
        setUser({ ...stored, onboardingCompleted: profile.onboardingCompleted });
      }
      return profile;
    },
    completeOnboarding: async () => {
      const token = getToken();
      if (!token) {
        throw new Error("Not signed in. Please wait for account sync or sign in again.");
      }
      const res = await fetch("/api/auth/onboarding/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to complete onboarding" }));
        throw new Error(err.detail || "Failed to complete onboarding");
      }
      const user = getStoredUser();
      if (user) setUser({ ...user, onboardingCompleted: true });
      return res.json();
    },
  },
  resumes: {
    list: async () => {
      const res = await apiFetch("/v1/resumes");
      if (!res.ok) throw new Error("Failed to fetch resumes");
      return res.json();
    },
    upload: async (file: File, label?: string) => {
      const formData = new FormData();
      formData.append("file", file);

      const parseRes = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });
      if (!parseRes.ok) {
        const err = await parseRes.json().catch(() => ({ error: "Parse failed" }));
        throw new Error(err.error || "Failed to parse resume file");
      }
      const parsed = await parseRes.json();

      const structuredData = parsed.text ? parseResumeText(parsed.text) : undefined;

      const res = await apiFetch("/v1/resumes/upload", {
        method: "POST",
        body: JSON.stringify({
          filename: parsed.filename || file.name,
          mimeType: parsed.mimeType || file.type,
          fileSize: parsed.fileSize || file.size,
          rawText: parsed.text,
          textPreview: parsed.textPreview || parsed.text.slice(0, 500),
          structuredData,
          label: label || file.name.replace(/\.[^/.]+$/, ""),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(err.detail || "Upload failed");
      }
      const uploaded = await res.json();
      return {
        ...uploaded,
        text: parsed.text,
        textPreview: parsed.textPreview || parsed.text.slice(0, 500),
      };
    },
    setDefault: async (id: string) => {
      const res = await apiFetch(`/v1/resumes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ setDefault: true }),
      });
      if (!res.ok) throw new Error("Failed to set default resume");
      return res.json();
    },
    update: async (id: string, data: { label?: string; profileRole?: string; lastAtsScore?: number }) => {
      const res = await apiFetch(`/v1/resumes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update resume");
      return res.json();
    },
    delete: async (id: string) => {
      const res = await apiFetch(`/v1/resumes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
  },
  jobs: {
    list: async (params?: { status?: string; source?: string }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.source) qs.set("source", params.source);
      const res = await apiFetch(`/v1/jobs?${qs.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json();
    },
    save: async (data: Record<string, unknown>) => {
      const res = await apiFetch("/v1/jobs", { method: "POST", body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed to save job");
      return res.json();
    },
    update: async (id: string, data: { status?: string; stage?: string; notes?: string }) => {
      const res = await apiFetch(`/v1/jobs/${id}`, { method: "PATCH", body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed to update job");
      return res.json();
    },
    delete: async (id: string) => {
      const res = await apiFetch(`/v1/jobs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
  },
  drafts: {
    get: async (draftId: string) => {
      // Draft endpoints don't require auth — draft ID is the access key
      const res = await fetch(`${API_URL}/v1/drafts/${draftId}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to fetch draft");
      return res.json();
    },
    compile: async (draftId: string, latexSource: string) => {
      const res = await fetch(`${API_URL}/v1/drafts/${draftId}/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latexSource }),
      });
      if (!res.ok) throw new Error("Compilation failed");
      return res.json();
    },
    convert: async (draftId: string, label: string) => {
      const res = await fetch(`${API_URL}/v1/drafts/${draftId}/convert`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error("Convert failed");
      return res.json();
    },
    saveState: async (draftId: string, data: {
      structuredResume: unknown;
      aiSuggestions: unknown[];
      currentScore: number;
    }) => {
      const res = await fetch(`${API_URL}/v1/drafts/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, ...data }),
      });
      if (!res.ok) throw new Error("Failed to save draft state");
      return res.json();
    },
  },
  ats: {
    analyze: async (resumeText: string, jobDescription: string) => {
      const res = await apiFetch("/v1/ats/analyze", {
        method: "POST",
        body: JSON.stringify({ resumeText, jobDescription }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      return res.json();
    },
  },
  tailoring: {
    create: async (data: {
      resumeId?: string;
      jobId?: string;
      resumeText: string;
      jobDescription: string;
      jobTitle?: string;
      company?: string;
    }) => {
      const res = await apiFetch("/v1/tailoring/create", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create tailoring run");
      return res.json();
    },
    get: async (runId: string) => {
      const res = await fetch(`${API_URL}/v1/tailoring/${runId}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to fetch tailoring run");
      return res.json();
    },
    complete: async (data: {
      runId: string;
      scoreAfter: number;
      suggestions: unknown[];
      latexSource?: string;
      provider?: string;
      latencyMs?: number;
    }) => {
      const res = await apiFetch("/v1/tailoring/complete", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to complete tailoring run");
      return res.json();
    },
  },
  coverLetters: {
    create: async (data: {
      jobId?: string;
      resumeVersionId?: string;
      tone?: string;
      content: string;
    }) => {
      const res = await apiFetch("/v1/cover-letters", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create cover letter");
      return res.json();
    },
    list: async () => {
      const res = await apiFetch("/v1/cover-letters");
      if (!res.ok) throw new Error("Failed to fetch cover letters");
      return res.json();
    },
  },
  templates: {
    list: async (category?: string) => {
      const qs = category ? `?category=${encodeURIComponent(category)}` : "";
      const res = await fetch(`/api/convex/v1/templates${qs}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
    seed: async () => {
      const res = await fetch(`/api/convex/v1/templates/seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to seed templates");
      return res.json();
    },
  },
};
