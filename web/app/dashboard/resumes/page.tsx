"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { PageHeader, EmptyState, Button, Card, SpinnerCenter } from "@/components/ui";

interface AnalysisResult {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
}

export default function ResumesPage() {
  const [resumes, setResumes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [analysisMap, setAnalysisMap] = useState<Record<string, AnalysisResult | null>>({});
  const [jdForAnalysis, setJdForAnalysis] = useState("");
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadResumes();
  }, []);

  async function loadResumes() {
    try {
      const data = await api.resumes.list();
      setResumes(data.resumes || []);
    } catch (err) {
      console.error("Failed to load resumes:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    setUploadSuccess("");
    try {
      await api.resumes.upload(file);
      await loadResumes();
      setUploadSuccess(`"${file.name}" uploaded and parsed successfully.`);
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await api.resumes.setDefault(id);
      await loadResumes();
    } catch (err: any) {
      setUploadError(err.message || "Failed to set default");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this resume?")) return;
    try {
      await api.resumes.delete(id);
      setResumes((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  async function analyzeResume(resume: any) {
    if (!jdForAnalysis.trim()) {
      alert("Enter a job description first to analyze your resume.");
      return;
    }
    setAnalyzingId(resume.id);
    try {
      const resumeText = resume.rawText || resume.textPreview || "";
      if (!resumeText) {
        alert("This resume has no text content. Re-upload with text content.");
        return;
      }
      const result = await api.ats.analyze(resumeText, jdForAnalysis);
      setAnalysisMap((prev) => ({
        ...prev,
        [resume.id]: {
          score: result.score || 0,
          matchedKeywords: (result.matchedKeywords || []).map((k: any) =>
            typeof k === "string" ? k : k.keyword || ""
          ),
          missingKeywords: (result.missingKeywords || []).map((k: any) =>
            typeof k === "string" ? k : k.keyword || ""
          ),
          suggestions: (result.suggestions || []).map((s: any) =>
            typeof s === "string" ? s : s.message || ""
          ),
        },
      }));
      await api.resumes.update(resume.id, { lastAtsScore: result.score || 0 });
      await loadResumes();
    } catch (err: any) {
      alert(err.message || "Analysis failed");
    } finally {
      setAnalyzingId(null);
    }
  }

  if (loading) return <SpinnerCenter />;

  return (
    <div>
      <PageHeader
        title="Resume Library"
        subtitle={`${resumes.length} resume${resumes.length !== 1 ? "s" : ""}`}
        action={
          <Button onClick={() => fileRef.current?.click()} loading={uploading} disabled={uploading}>
            + Upload Resume
          </Button>
        }
      />
      <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" onChange={handleUpload} className="hidden" />

      {uploadError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{uploadError}</div>
      )}
      {uploadSuccess && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">{uploadSuccess}</div>
      )}

      <Card className="mb-6">
        <h2 className="text-sm font-bold text-foreground mb-3">ATS Analysis (paste a job description)</h2>
        <textarea
          value={jdForAnalysis}
          onChange={(e) => setJdForAnalysis(e.target.value)}
          rows={3}
          placeholder="Paste a job description here, then click 'Check ATS Score' on any resume below..."
          className="w-full px-3 py-2 border border-border rounded-button text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
        />
      </Card>

      {resumes.length === 0 ? (
        <Card>
          <EmptyState
            title="No resumes uploaded yet"
            actionLabel="Upload your first resume"
            onAction={() => fileRef.current?.click()}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumes.map((resume) => {
            const analysis = analysisMap[resume.id];
            const displayScore = analysis?.score ?? resume.lastAtsScore ?? null;
            const scoreColor = displayScore != null
              ? displayScore >= 75 ? "text-green-600" : displayScore >= 50 ? "text-amber-500" : "text-red-500"
              : "text-slate-400";

            return (
              <div key={resume.id} className="bg-surface rounded-card p-5 shadow-card border border-border">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{resume.label || resume.filename}</div>
                      <div className="text-xs text-slate-400">{resume.filename}</div>
                    </div>
                  </div>
                  {resume.isDefault && (
                    <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded-full font-medium">Default</span>
                  )}
                  {displayScore != null && !analysis && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${scoreColor} bg-slate-50`}>
                      ATS {displayScore}
                    </span>
                  )}
                </div>
                {resume.textPreview && (
                  <p className="mt-3 text-xs text-slate-400 line-clamp-2">{resume.textPreview.slice(0, 150)}</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-300">
                    {resume.fileSize ? `${(resume.fileSize / 1024).toFixed(1)} KB` : ""}
                  </span>
                  <div className="flex gap-2">
                    {!resume.isDefault && (
                      <button
                        onClick={() => handleSetDefault(resume.id)}
                        className="text-xs text-primary hover:text-primary-hover font-medium"
                      >
                        Set default
                      </button>
                    )}
                    <button
                      onClick={() => analyzeResume(resume)}
                      disabled={analyzingId === resume.id || !jdForAnalysis.trim()}
                      className="text-xs text-primary hover:text-primary-hover font-medium disabled:text-slate-300 disabled:cursor-not-allowed"
                    >
                      {analyzingId === resume.id ? "Analyzing..." : "Check ATS Score"}
                    </button>
                    <button onClick={() => handleDelete(resume.id)} className="text-xs text-slate-400 hover:text-red-500">Delete</button>
                  </div>
                </div>

                {analysis && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xl font-black ${scoreColor}`}>{analysis.score}</span>
                      <span className="text-xs text-slate-400">/100</span>
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                        analysis.score >= 75 ? "bg-green-50 text-green-700" :
                        analysis.score >= 50 ? "bg-amber-50 text-amber-700" :
                        "bg-red-50 text-red-700"
                      }`}>
                        {analysis.score >= 75 ? "Good" : analysis.score >= 50 ? "Fair" : "Low"}
                      </span>
                    </div>
                    {analysis.matchedKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {analysis.matchedKeywords.slice(0, 6).map((kw) => (
                          <span key={kw} className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded-full">{kw}</span>
                        ))}
                      </div>
                    )}
                    {analysis.missingKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {analysis.missingKeywords.slice(0, 6).map((kw) => (
                          <span key={kw} className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-full">{kw}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
