"use client";

import { useState, useRef, Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Logo, Card, Button, SpinnerCenter } from "@/components/ui";

const STEPS = ["Welcome", "Upload", "Review", "Extension", "Done"] as const;

const inputClass =
  "w-full mt-1 px-3 py-2 bg-surface border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

function extractContactInfo(text: string) {
  const email = text.match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0] || "";
  const phone = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] || "";
  const firstLine = text.split("\n").find((l) => l.trim().length > 2)?.trim() || "";
  return { email, phone, name: firstLine };
}

function OnboardingContent() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [parsedText, setParsedText] = useState("");
  const [resumeLabel, setResumeLabel] = useState("");
  const [profileRole, setProfileRole] = useState("Software Engineer");
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [resumeId, setResumeId] = useState<string | null>(null);

  useEffect(() => {
    if (!api.auth.isLoggedIn()) {
      router.replace("/auth/sync");
    }
  }, [router]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const result = await api.resumes.upload(file);
      setResumeId(result.id);
      const text = result.text || result.textPreview || "";
      if (!text || text.length < 20) {
        throw new Error("Could not read resume text. Try a text-based PDF or DOCX file.");
      }
      setParsedText(text);
      setResumeLabel(file.name.replace(/\.[^/.]+$/, ""));
      setContact(extractContactInfo(text));
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleFinish() {
    setError("");
    try {
      await api.auth.completeOnboarding();
      if (resumeId) {
        try {
          await api.resumes.update(resumeId, {
            label: resumeLabel || undefined,
            profileRole,
          });
        } catch {
          // Non-blocking
        }
      }
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not finish onboarding");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <Logo />
          <p className="text-sm text-muted mt-2">Set up your account</p>
        </div>

        <div className="flex gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div className={`h-1 rounded-full ${i <= step ? "bg-primary" : "bg-border"}`} />
              <div className={`text-[10px] mt-1 ${i <= step ? "text-primary font-medium" : "text-muted"}`}>{label}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-danger">{error}</div>
        )}

        {step === 0 && (
          <Card padding="lg">
            <h1 className="text-2xl font-bold text-foreground mb-3">Tailor your resume in 30 seconds</h1>
            <p className="text-muted mb-6 leading-relaxed">
              Upload your resume once. Fluxpage will parse it, score it against jobs, and help you tailor applications from any job board.
            </p>
            <ul className="space-y-2 mb-8 text-sm text-foreground">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                ATS-optimized resume tailoring
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Cover letters matched to each job
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Cross-platform job tracker
              </li>
            </ul>
            <Button onClick={() => setStep(1)} className="w-full">Get started</Button>
          </Card>
        )}

        {step === 1 && (
          <Card padding="lg" className="text-center">
            <h2 className="text-xl font-bold text-foreground mb-2">Upload your resume</h2>
            <p className="text-muted text-sm mb-6">PDF, DOCX, or TXT. We extract the text automatically.</p>
            <Button onClick={() => fileRef.current?.click()} loading={uploading} disabled={uploading}>
              {uploading ? "Parsing resume..." : "Choose file"}
            </Button>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" onChange={handleUpload} className="hidden" />
          </Card>
        )}

        {step === 2 && (
          <Card padding="lg" className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Confirm your details</h2>
            <div>
              <label className="text-xs text-muted font-medium">Resume label</label>
              <input value={resumeLabel} onChange={(e) => setResumeLabel(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-muted font-medium">Target role profile</label>
              <select value={profileRole} onChange={(e) => setProfileRole(e.target.value)} className={inputClass}>
                <option>Software Engineer</option>
                <option>Product Manager</option>
                <option>Data Analyst</option>
                <option>Designer</option>
                <option>Other</option>
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted font-medium">Name (from resume)</label>
                <input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-muted font-medium">Email</label>
                <input value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 max-h-48 overflow-y-auto text-xs text-muted whitespace-pre-wrap border border-border">
              {parsedText.slice(0, 1200)}{parsedText.length > 1200 ? "..." : ""}
            </div>
            <Button onClick={() => setStep(3)} className="w-full">Continue</Button>
          </Card>
        )}

        {step === 3 && (
          <Card padding="lg">
            <h2 className="text-xl font-bold text-foreground mb-2">Install the Chrome extension</h2>
            <p className="text-muted text-sm mb-6">
              Tailor resumes directly from LinkedIn, Indeed, Naukri, and more. One click from any job page.
            </p>
            <div className="bg-slate-50 rounded-lg p-4 mb-6 text-sm text-foreground border border-border">
              Load the extension from <code className="text-primary font-mono text-xs">chrome://extensions</code> → Developer mode → Load unpacked → select this repo folder.
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setStep(4)} className="flex-1">I installed it</Button>
              <Button onClick={() => setStep(4)} variant="secondary" className="flex-1">Skip for now</Button>
            </div>
          </Card>
        )}

        {step === 4 && (
          <Card padding="lg" className="text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">You&apos;re all set</h2>
            <p className="text-muted text-sm mb-6">Your resume is ready. Open a job posting and start tailoring.</p>
            <Button onClick={handleFinish} className="w-full">Go to dashboard</Button>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<SpinnerCenter className="min-h-screen" />}>
      <OnboardingContent />
    </Suspense>
  );
}
