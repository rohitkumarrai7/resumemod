"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { downloadResumePdf } from "@/components/resume/ResumePDF";
import {
  applySuggestionToResume,
  parseResumeText,
  structuredResumeToText,
  type StructuredResume,
  type TailorSuggestion,
} from "@/lib/resumeParser";
import { Spinner, SpinnerCenter } from "@/components/ui";

function TailorContent() {
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"resume" | "cover-letter">("resume");
  const [draft, setDraft] = useState<any>(null);
  const [resume, setResume] = useState<StructuredResume | null>(null);
  const [suggestions, setSuggestions] = useState<TailorSuggestion[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [initialScore, setInitialScore] = useState<number | null>(null);
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);
  const [missingKeywords, setMissingKeywords] = useState<string[]>([]);
  const [jobDescription, setJobDescription] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [coverLetterTone, setCoverLetterTone] = useState("confident");
  const [isGeneratingCL, setIsGeneratingCL] = useState(false);
  const [template, setTemplate] = useState<"classic" | "compact" | "modern">("classic");

  const rescore = useCallback(async (nextResume: StructuredResume) => {
    if (!jobDescription) return;
    const text = structuredResumeToText(nextResume);
    try {
      const result = await api.ats.analyze(text, jobDescription);
      setScore(result.score || 0);
      setMatchedKeywords(
        (result.matchedKeywords || []).map((k: unknown) =>
          typeof k === "string" ? k : (k as { keyword: string }).keyword || ""
        )
      );
      setMissingKeywords(
        (result.missingKeywords || []).map((k: unknown) =>
          typeof k === "string" ? k : (k as { keyword: string }).keyword || ""
        )
      );
      return result.score || 0;
    } catch {
      return score || 0;
    }
  }, [jobDescription, score]);

  useEffect(() => {
    const saved = localStorage.getItem("rf_preferred_template");
    if (saved?.includes("compact")) setTemplate("compact");
    else if (saved?.includes("modern")) setTemplate("modern");
    else if (saved) setTemplate("classic");
  }, []);

  useEffect(() => {
    if (!draftId) {
      setLoading(false);
      setError("No draft ID. Open from the Chrome extension after analyzing a job.");
      return;
    }
    (async () => {
      try {
        const data = await api.drafts.get(draftId);
        setDraft(data);
        setInitialScore(data.initialScore ?? data.context?.analysis?.initialScore ?? null);
        setScore(data.currentAtsScore ?? data.context?.analysis?.currentScore ?? null);

        const gap = data.context?.analysis?.gapAnalysis || {};
        setMatchedKeywords(gap.matchedKeywords || []);
        setMissingKeywords(gap.missingKeywords || []);
        setJobDescription(data.context?.job?.description || "");

        let structured: StructuredResume | null = data.context?.structuredResume || null;
        if (!structured) {
          const raw =
            data.context?.analysis?.gapAnalysis?.resumeOriginalText ||
            data.context?.resume?.rawText ||
            "";
          if (raw) structured = parseResumeText(raw);
        }
        setResume(structured);

        const rawSuggestions: TailorSuggestion[] = (data.context?.aiSuggestions || []).map(
          (s: TailorSuggestion) => ({ ...s, applied: s.applied || false })
        );
        setSuggestions(rawSuggestions);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load draft");
      } finally {
        setLoading(false);
      }
    })();
  }, [draftId]);

  async function persistState(
    nextResume: StructuredResume,
    nextSuggestions: TailorSuggestion[],
    nextScore: number
  ) {
    if (!draftId) return;
    try {
      await api.drafts.saveState(draftId, {
        structuredResume: nextResume,
        aiSuggestions: nextSuggestions,
        currentScore: nextScore,
      });
    } catch {
      /* non-blocking */
    }
  }

  async function toggleSuggestion(id: string) {
    if (!resume) return;
    const suggestion = suggestions.find((s) => s.id === id);
    if (!suggestion) return;

    const willApply = !suggestion.applied;
    let nextResume = resume;
    if (willApply) {
      nextResume = applySuggestionToResume(resume, suggestion);
      setResume(nextResume);
    }

    const nextSuggestions = suggestions.map((s) =>
      s.id === id ? { ...s, applied: willApply } : s
    );
    setSuggestions(nextSuggestions);

    if (willApply) {
      const newScore = await rescore(nextResume);
      await persistState(nextResume, nextSuggestions, newScore);
    }
  }

  async function applyAll() {
    if (!resume) return;
    let nextResume = resume;
    const nextSuggestions = suggestions.map((s) => {
      if (s.applied) return s;
      nextResume = applySuggestionToResume(nextResume, s);
      return { ...s, applied: true };
    });
    setResume(nextResume);
    setSuggestions(nextSuggestions);
    const newScore = await rescore(nextResume);
    await persistState(nextResume, nextSuggestions, newScore);
  }

  async function generateCoverLetter() {
    if (!resume || !jobDescription) return;
    setIsGeneratingCL(true);
    try {
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: structuredResumeToText(resume),
          jobDescription,
          jobTitle: draft?.context?.job?.title || "",
          company: draft?.context?.job?.company || "",
          tone: coverLetterTone,
        }),
      });
      const data = await res.json();
      if (data.content) setCoverLetter(data.content);
      else setError(data.error || "Cover letter generation failed");
    } finally {
      setIsGeneratingCL(false);
    }
  }

  async function downloadPdf() {
    if (!resume) return;
    await downloadResumePdf(resume, template, "tailored-resume.pdf");
  }

  function downloadResumeText() {
    if (!resume) return;
    const blob = new Blob([structuredResumeToText(resume)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tailored-resume.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const scoreColor =
    score !== null
      ? score >= 75
        ? "text-success"
        : score >= 50
        ? "text-warning"
        : "text-danger"
      : "text-slate-500";
  const improvement =
    initialScore != null && score != null ? score - initialScore : null;
  const appliedCount = suggestions.filter((s) => s.applied).length;

  if (loading) {
    return (
      <div className="focus-shell min-h-screen flex items-center justify-center bg-[var(--focus-bg)]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !resume) {
    return (
      <div className="focus-shell min-h-screen flex items-center justify-center bg-[var(--focus-bg)] text-center px-6 text-[var(--focus-text)]">
        <div>
          <p className="text-red-300 mb-4">{error}</p>
          <a href="/dashboard" className="text-primary-400 hover:underline">Go to dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="focus-shell h-screen flex flex-col bg-[var(--focus-bg)] text-[var(--focus-text)]">
      <header className="h-14 border-b border-[var(--focus-border)] bg-[var(--focus-panel)] flex items-center justify-between px-4 flex-shrink-0">
        <div>
          <div className="font-semibold text-sm">
            {draft?.context?.job?.title || "Tailored Resume"}
          </div>
          <div className="text-xs text-slate-400">
            {draft?.context?.job?.company || ""}
            {draft?.context?.job?.source ? ` · ${draft.context.job.source}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value as typeof template)}
            className="text-xs bg-[var(--focus-input)] border border-[var(--focus-border)] rounded-lg px-2 py-1.5"
          >
            <option value="classic">Classic ATS</option>
            <option value="compact">Compact ATS</option>
            <option value="modern">Modern ATS</option>
          </select>
          <button
            onClick={downloadPdf}
            className="px-3 py-1.5 text-xs bg-success text-white rounded-button hover:opacity-90"
          >
            PDF
          </button>
          <button
            onClick={downloadResumeText}
            className="px-3 py-1.5 text-xs bg-[var(--focus-input)] border border-[var(--focus-border)] rounded-button hover:bg-[var(--focus-surface)]"
          >
            TXT
          </button>
          <a href="/dashboard/jobs" className="text-xs text-slate-400 hover:text-white">Tracker</a>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: score + suggestions */}
        <div className="w-80 border-r border-[var(--focus-border)] flex flex-col bg-[var(--focus-panel)]">
          <div className="p-4 border-b border-[var(--focus-border)]">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Match Score</div>
            <div className="flex items-center gap-3">
              <span className={`text-4xl font-black ${scoreColor}`}>{score ?? "—"}</span>
              <div>
                {improvement != null && improvement > 0 && (
                  <div className="text-emerald-400 text-sm font-bold">+{improvement}</div>
                )}
                {initialScore != null && (
                  <div className="text-xs text-slate-500">was {initialScore}</div>
                )}
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              {appliedCount}/{suggestions.length} suggestions applied
            </div>
          </div>

          <div className="p-3 border-b border-[var(--focus-border)] max-h-32 overflow-y-auto">
            {missingKeywords.slice(0, 8).map((kw) => (
              <span key={kw} className="inline-block text-[10px] px-2 py-0.5 mr-1 mb-1 rounded-full bg-red-500/10 text-red-300 border border-red-500/20">
                {kw}
              </span>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-300">Suggestions</span>
              <button onClick={applyAll} className="text-[10px] px-2 py-1 rounded bg-primary/20 text-primary-300">
                Apply all
              </button>
            </div>
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => toggleSuggestion(s.id)}
                className={`w-full text-left rounded-lg border p-2.5 transition-all ${
                  s.applied
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-[var(--focus-input)] border-[var(--focus-border)] hover:border-primary/40"
                }`}
              >
                <div className="flex gap-2">
                  <div className={`w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center ${
                    s.applied ? "bg-emerald-500 border-emerald-500" : "border-slate-600"
                  }`}>
                    {s.applied && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-200 leading-relaxed">{s.suggestedText}</p>
                    {s.keywords[0] && (
                      <span className="text-[10px] text-cyan-400 mt-1 inline-block">{s.keywords[0]}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: tabs + live preview */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex border-b border-[var(--focus-border)] bg-[var(--focus-panel)]">
            {(["resume", "cover-letter"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-primary text-primary-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab === "resume" ? "Resume" : "Cover Letter"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto p-6 bg-slate-100/5">
            {activeTab === "resume" && resume && (
              <div className="max-w-2xl mx-auto">
                <ResumePreview resume={resume} template={template} />
              </div>
            )}

            {activeTab === "cover-letter" && (
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="flex gap-2">
                  <select
                    value={coverLetterTone}
                    onChange={(e) => setCoverLetterTone(e.target.value)}
                    className="text-sm bg-[var(--focus-input)] border border-[var(--focus-border)] rounded-lg px-3 py-2 text-slate-200"
                  >
                    <option value="concise">Concise</option>
                    <option value="confident">Confident</option>
                    <option value="technical">Technical</option>
                    <option value="warm">Warm</option>
                  </select>
                  <button
                    onClick={generateCoverLetter}
                    disabled={isGeneratingCL}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover rounded-button text-sm font-medium disabled:opacity-50 text-white"
                  >
                    {isGeneratingCL ? "Generating..." : "Generate"}
                  </button>
                </div>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  rows={18}
                  placeholder="Generate a cover letter matched to this job..."
                  className="w-full bg-white text-slate-800 rounded-lg p-5 text-sm leading-relaxed border border-border outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TailorPage() {
  return (
    <Suspense fallback={<SpinnerCenter className="focus-shell min-h-screen bg-[var(--focus-bg)]" />}>
      <TailorContent />
    </Suspense>
  );
}
