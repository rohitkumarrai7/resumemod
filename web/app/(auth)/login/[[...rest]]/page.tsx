"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthLayout, SpinnerCenter } from "@/components/ui";
import { ClerkSignInForm } from "@/components/auth/ClerkAuthForms";

function getRedirectTarget(searchParams: ReturnType<typeof useSearchParams>) {
  return searchParams.get("redirect") || searchParams.get("redirect_url") || "";
}

function LoginContent() {
  const searchParams = useSearchParams();
  const redirect = getRedirectTarget(searchParams);
  const afterSignIn = redirect
    ? `/auth/sync?redirect=${encodeURIComponent(redirect)}`
    : "/auth/sync";
  const registerUrl = redirect
    ? `/register?redirect=${encodeURIComponent(redirect)}`
    : "/register";

  return (
    <AuthLayout subtitle="Sign in to tailor your resume and track applications.">
      <div className="text-center mb-6 lg:hidden">
        <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
        <p className="text-muted text-sm mt-1">Sign in to your Fluxpage account</p>
      </div>
      <ClerkSignInForm signUpUrl={registerUrl} forceRedirectUrl={afterSignIn} />
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<SpinnerCenter className="min-h-screen" />}>
      <LoginContent />
    </Suspense>
  );
}
