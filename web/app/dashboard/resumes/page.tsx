"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";

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
    try {
      await api.resumes.upload(file);
      await loadResumes();
    } catch (err: any) {
      alert(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
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
    } catch (err: any) {
      alert(err.message || "Analysis failed");
    } finally {
      setAnalyzingId(null);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resume Library</h1>
          <p className="text-slate-500 mt-1">{resumes.length} resume{resumes.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "+ Upload Resume"}
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" onChange={handleUpload} className="hidden" />
      </div>

      <div className="mb-6 bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <h2 className="text-sm font-bold text-slate-900 mb-3">ATS Analysis (paste a job description)</h2>
        <textarea
          value={jdForAnalysis}
          onChange={(e) => setJdForAnalysis(e.target.value)}
          rows={3}
          placeholder="Paste a job description here, then click 'Check ATS Score' on any resume below..."
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y"
        />
      </div>

      {resumes.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-100">
          <p className="text-slate-400 mb-4">No resumes uploaded yet.</p>
          <button onClick={() => fileRef.current?.click()} className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg">
            Upload your first resume
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumes.map((resume) => {
            const analysis = analysisMap[resume.id];
            const scoreColor = analysis
              ? analysis.score >= 75 ? "text-green-600" : analysis.score >= 50 ? "text-amber-500" : "text-red-500"
              : "text-slate-400";

            return (
              <div key={resume.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
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
                </div>
                {resume.textPreview && (
                  <p className="mt-3 text-xs text-slate-400 line-clamp-2">{resume.textPreview.slice(0, 150)}</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-300">
                    {resume.fileSize ? `${(resume.fileSize / 1024).toFixed(1)} KB` : ""}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => analyzeResume(resume)}
                      disabled={analyzingId === resume.id || !jdForAnalysis.trim()}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:text-slate-300 disabled:cursor-not-allowed"
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
