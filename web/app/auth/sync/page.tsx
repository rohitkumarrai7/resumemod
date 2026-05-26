"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { AuthLayout, Spinner } from "@/components/ui";

const SyncContent = dynamic(() => import("./SyncContent"), {
  ssr: false,
  loading: () => (
    <AuthLayout title="Almost there" subtitle="We're connecting your account to Fluxpage.">
      <div className="flex justify-center">
        <Spinner size="lg" />
      </div>
    </AuthLayout>
  ),
});

export default function AuthSyncPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <AuthLayout title="Auth not configured" subtitle="Clerk keys are required for account sync.">
        <p className="text-sm text-muted text-center">
          Set <code className="text-xs">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{" "}
          <code className="text-xs">CLERK_SECRET_KEY</code> in your host environment.
        </p>
      </AuthLayout>
    );
  }

  return (
    <Suspense
      fallback={
        <AuthLayout title="Almost there" subtitle="We're connecting your account to Fluxpage.">
          <div className="flex justify-center">
            <Spinner size="lg" />
          </div>
        </AuthLayout>
      }
    >
      <SyncContent />
    </Suspense>
  );
}
