"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useEditorStore } from "@/lib/store";
import { api } from "@/lib/api";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

function EditorContent() {
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft");
  const resumeTextParam = searchParams.get("resumeText") || "";
  const {
    latexSource, pdfUrl, isCompiling, atsScore,
    missingKeywords, matchedKeywords, jobTitle, companyName,
    autoCompile, loadDraft, compile, setLatexSource, setAutoCompile,
    optimizeWithLLM, setResumeTextExternal,
  } = useEditorStore();

useEffect(() => {
    if (resumeTextParam) {
      setResumeTextExternal(resumeTextParam);
    }
  }, [resumeTextParam, setResumeTextExternal]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draftContext, setDraftContext] = useState<any>(null);
  const [initialScore, setInitialScore] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [rightPanel, setRightPanel] = useState<"preview" | "jd" | "resume">("preview");
  const compileTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (draftId) {
      loadDraft(draftId).finally(() => setLoading(false));
      loadDraftContext(draftId);
    } else {
      setLoading(false);
      setError("No draft ID provided. Open from the Chrome extension after analyzing a job.");
    }
  }, [draftId, loadDraft]);

  async function loadDraftContext(id: string) {
    try {
      const data = await api.drafts.get(id);
      setDraftContext(data);
      if (data.initialScore != null) {
        setInitialScore(data.initialScore);
      }
      if (data.context?.analysis?.gapAnalysis?.suggestions) {
        setSuggestions(data.context.analysis.gapAnalysis.suggestions);
      }
    } catch (err) {
      console.error("Failed to load draft context:", err);
    }
  }

  const handleSourceChange = useCallback((value: string | undefined) => {
    if (!value) return;
    setLatexSource(value);
    if (autoCompile && draftId) {
      if (compileTimer.current) clearTimeout(compileTimer.current);
      compileTimer.current = setTimeout(() => compile(), 1500);
    }
  }, [autoCompile, draftId, compile, setLatexSource]);

  async function handleDownloadTex() {
    const source = latexSource;
    if (!source) return;
    const blob = new Blob([source], { type: "text/x-latex" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (jobTitle || "resume") + ".tex";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleDownloadPDF() {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = (jobTitle || "resume") + ".pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleAIOptimize() {
    setIsOptimizing(true);
    try {
      const result = await optimizeWithLLM();
      if (result?.error && !result.latexSource) {
        setError(result.error);
      }
      if (result?.latexSource) {
        setTimeout(() => compile(), 500);
      }
    } catch (err: any) {
      setError(err.message || "AI optimization failed");
    } finally {
      setIsOptimizing(false);
    }
  }

  // Extract context data
  const jobDescription = draftContext?.context?.job?.description || "";

  function cleanResumeText(text: string) {
    if (!text || typeof text !== "string") return "";
    if (text.startsWith("JVBERi0") || text.startsWith("iVBORw0K")) return "";
    const pdfMarkers = ["%PDF", "PDF-1.", "/Linearized", "/Type /XRef", "/Type /Catalog", "endobj", "endstream", "<< /", "obj<<", "streamx", "/Filter /FlateDecode", "\\documentclass", "JVBERi0", "iVBORw0K"];
    if (pdfMarkers.some(m => text.includes(m))) return "";
    if ((text.match(/[^\x20-\x7E\t\n\r]/g) || []).length / text.length > 0.3) return "";
    return text;
  }

  const rawResumeText = draftContext?.context?.analysis?.gapAnalysis?.resumeOriginalText
    || draftContext?.context?.resume?.rawText
    || draftContext?.context?.resume?.textPreview
    || resumeTextParam
    || "";
  const resumeOriginalText = cleanResumeText(rawResumeText);
  const contextJobTitle = draftContext?.context?.job?.title || jobTitle || "";
  const contextCompany = draftContext?.context?.job?.company || companyName || "";
  const contextSource = draftContext?.context?.job?.source || "";
  const contextMissing = draftContext?.context?.analysis?.gapAnalysis?.missingKeywords || missingKeywords || [];
  const contextMatched = draftContext?.context?.analysis?.gapAnalysis?.matchedKeywords || matchedKeywords || [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-slate-300 font-medium">Loading draft...</p>
          <p className="text-slate-500 text-sm mt-1">Preparing your optimized resume</p>
        </div>
      </div>
    );
  }

  if (error && !latexSource) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📋</div>
          <h1 className="text-2xl font-bold text-white mb-2">Draft Error</h1>
          <p className="text-slate-400">{error}</p>
          <a href="/dashboard" className="inline-block mt-6 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg">
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  const scoreColor = atsScore !== null
    ? atsScore >= 75 ? "text-green-400" : atsScore >= 50 ? "text-amber-400" : "text-red-400"
    : "text-slate-500";

  const scoreImprovement = initialScore != null && atsScore != null ? atsScore - initialScore : null;

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <header className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center font-black text-white text-sm">R</div>
          <div>
            <div className="text-white font-semibold text-sm">
              {contextJobTitle || "Resume Editor"}
            </div>
            <div className="text-slate-400 text-xs">
              {contextCompany && `${contextCompany} · `}{contextSource && `${contextSource.toUpperCase()} · `}Optimized Resume
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-slate-400 text-xs flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCompile}
              onChange={(e) => setAutoCompile(e.target.checked)}
              className="rounded border-slate-600"
            />
            Auto-compile
          </label>
          <button
            onClick={() => compile()}
            disabled={isCompiling}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isCompiling ? "Compiling..." : "Compile"}
          </button>
          <button
            onClick={handleAIOptimize}
            disabled={isOptimizing || !draftId}
            className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/20"
          >
            {isOptimizing ? "✨ AI Optimizing..." : "✨ AI Optimize"}
          </button>
          <button
            onClick={handleDownloadTex}
            className="px-3 py-1.5 bg-slate-700 text-white text-xs font-medium rounded-lg hover:bg-slate-600 transition-colors"
          >
            Download .tex
          </button>
          {pdfUrl && (
            <button
              onClick={handleDownloadPDF}
              className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors shadow-lg shadow-green-500/20"
            >
              📥 Download PDF
            </button>
          )}
          {latexSource && (
            <form method="POST" action="https://www.overleaf.com/docs" target="_blank" className="m-0 p-0">
              <input type="hidden" name="snip" value={latexSource} />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#47A141] text-white text-xs font-medium rounded-lg hover:bg-[#3d8c38] transition-colors shadow-lg shadow-[#47A141]/20 flex items-center gap-1"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13.88 17.76C13.2 18.06 12.38 18.24 11.45 18.24C8.74 18.24 6.8 16.48 6.8 13.88V9.6C6.8 9.06 7 8.65 7.42 8.35C7.75 8.1 8.24 7.96 8.9 7.96H9.76V9.45H9.2C8.88 9.45 8.68 9.5 8.52 9.62C8.38 9.72 8.32 9.9 8.32 10.15V13.88C8.32 15.65 9.45 16.75 11.45 16.75C12 16.75 12.5 16.65 12.85 16.5V17.76H13.88Z" fill="currentColor"/>
                </svg>
                Overleaf
              </button>
            </form>
          )}
          <a href="/dashboard" className="text-slate-400 hover:text-white text-xs">Dashboard</a>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-700 px-4 py-2 text-red-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar: ATS Analysis */}
        <div className="w-72 bg-slate-800 border-r border-slate-700 overflow-y-auto flex-shrink-0 flex flex-col">
          {/* ATS Score */}
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">ATS Score</span>
              {initialScore != null && (
                <span className="text-slate-500 text-xs">was {initialScore}</span>
              )}
            </div>
            <div className="flex items-end gap-2">
              <span className={`text-4xl font-black ${scoreColor}`}>
                {atsScore !== null ? atsScore : "—"}
              </span>
              <span className="text-slate-500 text-lg mb-1">/100</span>
              {scoreImprovement != null && scoreImprovement > 0 && (
                <span className="text-green-400 text-sm font-bold mb-1">+{scoreImprovement}</span>
              )}
            </div>
          </div>

          {/* Missing keywords */}
          {contextMissing.length > 0 && (
            <div className="p-4 border-b border-slate-700">
              <div className="text-xs font-medium text-red-400 uppercase tracking-wider mb-2">
                Missing Keywords ({contextMissing.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {contextMissing.map((kw: string) => (
                  <span key={kw} className="text-xs px-2 py-0.5 bg-red-900/40 text-red-300 rounded-full border border-red-800/50">{kw}</span>
                ))}
              </div>
            </div>
          )}

          {/* Matched keywords */}
          {contextMatched.length > 0 && (
            <div className="p-4 border-b border-slate-700">
              <div className="text-xs font-medium text-green-400 uppercase tracking-wider mb-2">
                Matched Keywords ({contextMatched.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {contextMatched.map((kw: string) => (
                  <span key={kw} className="text-xs px-2 py-0.5 bg-green-900/40 text-green-300 rounded-full border border-green-800/50">{kw}</span>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="p-4 border-b border-slate-700">
              <div className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2">
                Optimization Tips
              </div>
              <div className="space-y-2">
                {suggestions.map((s: any, i: number) => (
                  <div key={i} className="text-xs text-slate-300 leading-relaxed bg-slate-700/50 rounded p-2">
                    {typeof s === "string" ? s : s.message || s.tip || ""}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Optimize CTA */}
          <div className="p-4 mt-auto">
            <button
              onClick={handleAIOptimize}
              disabled={isOptimizing || !draftId}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/20"
            >
              {isOptimizing ? "✨ AI Optimizing..." : "✨ AI Optimize with LLM"}
            </button>
            <p className="text-slate-500 text-xs mt-2 text-center">
              Uses your resume + JD + ATS feedback
            </p>
          </div>
        </div>

        {/* Main editor area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex overflow-hidden">
            {/* LaTeX editor */}
            <div className="w-1/2 border-r border-slate-700 flex flex-col">
              <div className="px-3 py-2 bg-slate-800 border-b border-slate-700 text-slate-300 text-xs font-medium">
                LaTeX Source
              </div>
              <div className="flex-1">
                <MonacoEditor
                  height="100%"
                  language="latex"
                  theme="vs-dark"
                  value={latexSource}
                  onChange={handleSourceChange}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: "on",
                    wordWrap: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
              </div>
            </div>

            {/* Right panel: PDF Preview / JD / Resume */}
            <div className="w-1/2 flex flex-col bg-slate-900">
              {/* Panel tabs */}
              <div className="flex items-center bg-slate-800 border-b border-slate-700 px-1">
                <button
                  onClick={() => setRightPanel("preview")}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    rightPanel === "preview" ? "text-blue-400 border-b-2 border-blue-400" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  PDF Preview
                </button>
                <button
                  onClick={() => setRightPanel("jd")}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    rightPanel === "jd" ? "text-blue-400 border-b-2 border-blue-400" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📄 Job Description
                </button>
                <button
                  onClick={() => setRightPanel("resume")}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    rightPanel === "resume" ? "text-blue-400 border-b-2 border-blue-400" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📝 Original Resume
                </button>
                <div className="ml-auto flex items-center gap-2 pr-2">
                  <span className={`text-2xl font-black ${scoreColor}`}>
                    {atsScore !== null ? `${atsScore}` : "—"}
                  </span>
                  <span className="text-xs text-slate-500">/100</span>
                </div>
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-auto">
                {rightPanel === "preview" && (
                  <div className="h-full bg-slate-100 flex items-start justify-center p-4">
                    {pdfUrl ? (
                      <iframe src={pdfUrl} className="w-full h-full border-0 bg-white shadow-lg" title="PDF Preview" />
                    ) : (
                      <div className="flex items-center justify-center h-full w-full text-slate-400 text-sm">
                        <div className="text-center">
                          <div className="text-4xl mb-3">📄</div>
                          <p>Click &quot;Compile&quot; to see PDF preview</p>
                          <p className="text-xs mt-2 text-slate-500">The LaTeX source will be compiled to PDF</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {rightPanel === "jd" && (
                  <div className="p-4">
                    {jobDescription ? (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="text-slate-200 font-semibold text-sm">Job Description</h3>
                          {contextJobTitle && (
                            <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded-full">{contextJobTitle}</span>
                          )}
                          {contextCompany && (
                            <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full">{contextCompany}</span>
                          )}
                        </div>
                        <div className="bg-slate-800 rounded-lg p-4 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap max-h-[calc(100vh-200px)] overflow-auto border border-slate-700">
                          {jobDescription}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-slate-500 py-20">
                        <div className="text-4xl mb-3">📄</div>
                        <p>No job description available</p>
                        <p className="text-xs mt-1">The JD will appear here when sent from the extension</p>
                      </div>
                    )}
                  </div>
                )}

                {rightPanel === "resume" && (
                  <div className="p-4">
                    {resumeOriginalText ? (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="text-slate-200 font-semibold text-sm">Original Resume</h3>
                          <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-400 rounded-full">Before optimization</span>
                        </div>
                        <div className="bg-slate-800 rounded-lg p-4 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap max-h-[calc(100vh-200px)] overflow-auto border border-slate-700">
                          {resumeOriginalText}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-slate-500 py-20">
                        <div className="text-4xl mb-3">📝</div>
                        <p>No resume text available</p>
                        <p className="text-xs mt-1">Upload a text-based resume (.txt) for full text extraction</p>
                        <p className="text-xs mt-1 text-slate-600">PDF text extraction is not yet supported</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Keywords bar at bottom */}
              <div className="border-t border-slate-700 p-3 bg-slate-800 flex-shrink-0">
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {(matchedKeywords || []).slice(0, 15).map((kw) => (
                    <span key={kw} className="text-xs px-2 py-0.5 bg-green-900/40 text-green-300 rounded-full">{kw}</span>
                  ))}
                </div>
                {missingKeywords.length > 0 && (
                  <div className="mt-1.5">
                    <span className="text-xs text-red-400 mr-1">Missing:</span>
                    <span className="flex flex-wrap gap-1 inline">
                      {missingKeywords.slice(0, 10).map((kw) => (
                        <span key={kw} className="text-xs px-2 py-0.5 bg-red-900/30 text-red-300 rounded-full">{kw}</span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto" />
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
}
