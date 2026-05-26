"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { AuthLayout, Button, Spinner } from "@/components/ui";

export default function SyncContent() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/clerk-sync", { method: "POST" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Sync failed" }));
          throw new Error(err.detail || "Sync failed");
        }
        const data = await res.json();
        if (cancelled) return;

        localStorage.setItem("rf_access_token", data.tokens.access);
        localStorage.setItem("rf_refresh_token", data.tokens.refresh);
        localStorage.setItem("rf_user", JSON.stringify(data.user));

        const redirect = searchParams.get("redirect");
        if (redirect) {
          const separator = redirect.includes("?") ? "&" : "?";
          window.location.replace(
            redirect +
              separator +
              "token=" +
              encodeURIComponent(data.tokens.access) +
              "&refresh=" +
              encodeURIComponent(data.tokens.refresh)
          );
          return;
        }

        router.replace(data.user.onboardingCompleted ? "/dashboard" : "/onboarding");
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Sync failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, router, searchParams]);

  return (
    <AuthLayout title="Almost there" subtitle="We're connecting your account to Fluxpage.">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-danger mb-4 text-sm">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </>
        ) : (
          <>
            <Spinner size="lg" className="mx-auto mb-4" />
            <p className="text-muted text-sm">Setting up your account...</p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
