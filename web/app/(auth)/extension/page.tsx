"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { AuthLayout, Button, Card, Logo, Spinner } from "@/components/ui";

const inputClass =
  "w-full px-4 py-2.5 border border-border rounded-button focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm";

function ExtensionAuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"login" | "register" | "redirecting">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const redirect = searchParams.get("redirect") || "";

  useEffect(() => {
    if (api.auth.isLoggedIn()) {
      handleRedirect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRedirect() {
    const token = localStorage.getItem("rf_access_token") || "";
    const refresh = localStorage.getItem("rf_refresh_token") || "";

    if (!redirect) {
      router.push("/dashboard");
      return;
    }

    setStatus("redirecting");
    const separator = redirect.includes("?") ? "&" : "?";
    window.location.replace(
      redirect + separator + "token=" + encodeURIComponent(token) + "&refresh=" + encodeURIComponent(refresh)
    );
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.auth.login(email, password);
      handleRedirect();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.auth.register(email, password, name);
      handleRedirect();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  }

  if (status === "redirecting") {
    return (
      <AuthLayout title="Connecting extension" subtitle="Redirecting you back to the Chrome extension.">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-muted text-sm">You&apos;ll be redirected automatically</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Connect your extension"
      subtitle="Sign in to link the Fluxpage Chrome extension to your account."
    >
      <div className="text-center mb-6 lg:hidden">
        <Logo className="justify-center mb-4" />
        <p className="text-muted text-sm">
          {status === "register" ? "Create account to connect extension" : "Sign in to connect the Chrome extension"}
        </p>
      </div>

      <p className="text-center text-sm text-muted mb-4 hidden lg:block">
        Prefer Clerk sign-in?{" "}
        <Link
          href={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login"}
          className="text-primary hover:text-primary-hover font-medium"
        >
          Use secure login
        </Link>
      </p>

      {status === "login" ? (
        <Card padding="md">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-danger px-4 py-3 rounded-lg text-sm">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="Enter your password" required />
            </div>
            <Button type="submit" className="w-full">Sign In &amp; Connect Extension</Button>
            <p className="text-center text-sm text-muted">
              Don&apos;t have an account?{" "}
              <button type="button" onClick={() => { setStatus("register"); setError(""); }} className="text-primary hover:text-primary-hover font-medium">
                Create one
              </button>
            </p>
          </form>
        </Card>
      ) : (
        <Card padding="md">
          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-danger px-4 py-3 rounded-lg text-sm">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Your name" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="Min 8 characters" required minLength={8} />
            </div>
            <Button type="submit" className="w-full">Create Account &amp; Connect</Button>
            <p className="text-center text-sm text-muted">
              Already have an account?{" "}
              <button type="button" onClick={() => { setStatus("login"); setError(""); }} className="text-primary hover:text-primary-hover font-medium">
                Sign in
              </button>
            </p>
          </form>
        </Card>
      )}
    </AuthLayout>
  );
}

export default function AuthExtensionPage() {
  return (
    <Suspense fallback={<AuthLayout><Spinner size="lg" className="mx-auto" /></AuthLayout>}>
      <ExtensionAuthContent />
    </Suspense>
  );
}
