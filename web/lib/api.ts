const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://stoic-caiman-320.convex.site";

export interface User {
  id: string;
  email: string;
  name: string | null;
  tier: string;
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
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401 && token) {
    const refreshed = await refreshToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${getToken()}`;
      return fetch(`${API_URL}${path}`, { ...options, headers });
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
  },
  resumes: {
    list: async () => {
      const res = await apiFetch("/v1/resumes");
      if (!res.ok) throw new Error("Failed to fetch resumes");
      return res.json();
    },
    upload: async (file: File) => {
      // Read file content as text for the Convex JSON endpoint
      const text = await file.text();
      const res = await apiFetch("/v1/resumes/upload", {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
          rawText: text,
          textPreview: text.slice(0, 500),
          label: file.name.replace(/\.[^/.]+$/, ""),
        }),
      });
      if (!res.ok) throw new Error("Upload failed");
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
    update: async (id: string, data: { status?: string; notes?: string }) => {
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
};
