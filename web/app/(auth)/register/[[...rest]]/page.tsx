"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthLayout, SpinnerCenter } from "@/components/ui";
import { ClerkSignUpForm } from "@/components/auth/ClerkAuthForms";

function getRedirectTarget(searchParams: ReturnType<typeof useSearchParams>) {
  return searchParams.get("redirect") || searchParams.get("redirect_url") || "";
}

function RegisterContent() {
  const searchParams = useSearchParams();
  const redirect = getRedirectTarget(searchParams);
  const afterSignUp = redirect
    ? `/auth/sync?redirect=${encodeURIComponent(redirect)}`
    : "/auth/sync";
  const loginUrl = redirect
    ? `/login?redirect=${encodeURIComponent(redirect)}`
    : "/login";

  return (
    <AuthLayout subtitle="Create your account and start tailoring resumes in 30 seconds.">
      <div className="text-center mb-6 lg:hidden">
        <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
        <p className="text-muted text-sm mt-1">Free plan — no credit card required</p>
      </div>
      <ClerkSignUpForm signInUrl={loginUrl} forceRedirectUrl={afterSignUp} />
    </AuthLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<SpinnerCenter className="min-h-screen" />}>
      <RegisterContent />
    </Suspense>
  );
}
