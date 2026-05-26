"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function EditorRedirect() {
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft");

  useEffect(() => {
    if (draftId) {
      window.location.replace(`/tailor?draft=${encodeURIComponent(draftId)}`);
    }
  }, [draftId]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0E1A] text-white gap-4">
      <p className="text-slate-400 text-sm">
        {draftId ? "Redirecting to tailor editor..." : "Open from the Chrome extension or dashboard."}
      </p>
      <a href="/dashboard" className="text-primary-400 hover:underline text-sm">Go to dashboard</a>
      <a href="/editor/advanced" className="text-slate-500 hover:text-slate-300 text-xs">Advanced LaTeX editor</a>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0E1A]" />}>
      <EditorRedirect />
    </Suspense>
  );
}
