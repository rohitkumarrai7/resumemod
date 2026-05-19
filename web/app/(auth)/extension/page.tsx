"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function ExtensionAuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"login" | "register" | "redirecting" | "success" | "error">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const redirect = searchParams.get("redirect") || "";

  useEffect(() => {
    // If already logged in, immediately redirect back to extension
    if (api.auth.isLoggedIn()) {
      handleRedirect();
    }
  }, []);

  function handleRedirect() {
    const token = localStorage.getItem("rf_access_token") || "";
    const refresh = localStorage.getItem("rf_refresh_token") || "";

    if (!redirect) {
      // No redirect specified — just go to dashboard
      router.push("/dashboard");
      return;
    }

    setStatus("redirecting");

    // Build the redirect URL with tokens as query params
    // The redirect URL points to chrome-extension://<id>/callback.html
    const separator = redirect.includes("?") ? "&" : "?";
    const redirectUrl = redirect + separator +
      "token=" + encodeURIComponent(token) +
      "&refresh=" + encodeURIComponent(refresh);

    // Use location.replace so user can't go back to this page
    window.location.replace(redirectUrl);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.auth.login(email, password);
      handleRedirect();
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.auth.register(email, password, name);
      handleRedirect();
    } catch (err: any) {
      setError(err.message || "Registration failed");
    }
  }

  if (status === "redirecting") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400 mx-auto mb-4" />
          <p className="text-blue-100 font-medium">Connecting extension...</p>
          <p className="text-blue-300 text-sm mt-2">You&apos;ll be redirected back automatically</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-white font-semibold text-lg">Extension connected!</p>
          <p className="text-blue-200 text-sm mt-2">You can close this tab</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 text-white text-2xl font-black shadow-lg mb-4">
            R
          </div>
          <h1 className="text-3xl font-bold text-white">ResumeForge</h1>
          <p className="text-blue-200 mt-2">
            {status === "register" ? "Create account to connect extension" : "Sign in to connect the Chrome extension"}
          </p>
        </div>

        {status === "login" ? (
          <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-2xl p-8 space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/25"
            >
              Sign In &amp; Connect Extension
            </button>

            <p className="text-center text-sm text-slate-500">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => { setStatus("register"); setError(""); }}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Create one
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="bg-white rounded-2xl shadow-2xl p-8 space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Your name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Min 8 characters"
                required
                minLength={8}
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-green-700 transition-all shadow-lg shadow-green-500/25"
            >
              Create Account &amp; Connect
            </button>

            <p className="text-center text-sm text-slate-500">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { setStatus("login"); setError(""); }}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Sign in
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AuthExtensionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400 mx-auto" />
      </div>
    }>
      <ExtensionAuthContent />
    </Suspense>
  );
}
