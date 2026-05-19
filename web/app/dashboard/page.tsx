"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import Link from "next/link";

interface AnalysisResult {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState({ jobs: 0, resumes: 0, avgScore: 0 });
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [atsResult, setAtsResult] = useState<AnalysisResult | null>(null);
  const [atsJobDescription, setAtsJobDescription] = useState("");
  const [analyzingAts, setAnalyzingAts] = useState(false);
  const [atsResumes, setAtsResumes] = useState<any[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [jobsData, resumesData] = await Promise.all([
        api.jobs.list(),
        api.resumes.list(),
      ]);
      const jobs = jobsData.jobs || [];
      const resumes = resumesData.resumes || [];
      setAtsResumes(resumes);
      if (resumes.length > 0) {
        const def = resumes.find((r: any) => r.isDefault) || resumes[0];
        setSelectedResumeId(def.id);
      }
      const scores = jobs
        .filter((j: any) => j.atsScore != null)
        .map((j: any) => j.atsScore);
      setStats({
        jobs: jobs.length,
        resumes: resumes.length,
        avgScore: scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0,
      });
      setRecentJobs(jobs.slice(0, 5));
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingResume(true);
    try {
      await api.resumes.upload(file);
      await load();
    } catch (err: any) {
      alert(err.message || "Upload failed");
    } finally {
      setUploadingResume(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function runAtsAnalysis() {
    if (!atsJobDescription.trim() || !selectedResumeId) return;
    setAnalyzingAts(true);
    setAtsResult(null);
    try {
      const resume = atsResumes.find((r: any) => r.id === selectedResumeId);
      const resumeText = resume?.rawText || resume?.textPreview || "";
      if (!resumeText) {
        alert("Selected resume has no text content. Please re-upload.");
        setAnalyzingAts(false);
        return;
      }
      const result = await api.ats.analyze(resumeText, atsJobDescription);
      setAtsResult({
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
      });
    } catch (err: any) {
      alert(err.message || "ATS analysis failed");
    } finally {
      setAnalyzingAts(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600" /></div>;
  }

  const scoreColor = atsResult
    ? atsResult.score >= 75 ? "text-green-600" : atsResult.score >= 50 ? "text-amber-500" : "text-red-500"
    : "text-slate-400";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Your resume optimization overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="text-3xl font-black text-slate-900">{stats.jobs}</div>
          <div className="text-sm text-slate-500 mt-1">Saved Jobs</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="text-3xl font-black text-slate-900">{stats.resumes}</div>
          <div className="text-sm text-slate-500 mt-1">Resumes</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="text-3xl font-black text-slate-900">{stats.avgScore > 0 ? stats.avgScore : "\u2014"}</div>
          <div className="text-sm text-slate-500 mt-1">Avg ATS Score</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-4">ATS Score Check</h2>
          <p className="text-sm text-slate-500 mb-4">Upload a resume and paste a job description to get your real ATS score.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Resume</label>
              <div className="flex gap-2">
                <select
                  value={selectedResumeId}
                  onChange={(e) => setSelectedResumeId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  {atsResumes.length === 0 ? (
                    <option value="">No resumes uploaded</option>
                  ) : (
                    atsResumes.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.label || r.filename}</option>
                    ))
                  )}
                </select>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingResume}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {uploadingResume ? "Uploading..." : "+ Upload"}
                </button>
                <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" onChange={handleResumeUpload} className="hidden" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Job Description</label>
              <textarea
                value={atsJobDescription}
                onChange={(e) => setAtsJobDescription(e.target.value)}
                rows={5}
                placeholder="Paste the job description here..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y"
              />
            </div>

            <button
              onClick={runAtsAnalysis}
              disabled={analyzingAts || !atsJobDescription.trim() || !selectedResumeId}
              className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyzingAts ? "Analyzing..." : "Analyze ATS Score"}
            </button>

            {atsResult && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`text-4xl font-black ${scoreColor}`}>{atsResult.score}</div>
                  <div className="text-sm text-slate-500">/100 ATS Score</div>
                  <span className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold ${
                    atsResult.score >= 75 ? "bg-green-50 text-green-700" :
                    atsResult.score >= 50 ? "bg-amber-50 text-amber-700" :
                    "bg-red-50 text-red-700"
                  }`}>
                    {atsResult.score >= 75 ? "Good Match" : atsResult.score >= 50 ? "Fair Match" : "Low Match"}
                  </span>
                </div>

                {atsResult.matchedKeywords.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-green-700 mb-1">Matched Keywords ({atsResult.matchedKeywords.length})</div>
                    <div className="flex flex-wrap gap-1.5">
                      {atsResult.matchedKeywords.slice(0, 15).map((kw) => (
                        <span key={kw} className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}

                {atsResult.missingKeywords.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-amber-700 mb-1">Missing Keywords ({atsResult.missingKeywords.length})</div>
                    <div className="flex flex-wrap gap-1.5">
                      {atsResult.missingKeywords.slice(0, 15).map((kw) => (
                        <span key={kw} className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}

                {atsResult.suggestions.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-700 mb-1">Suggestions</div>
                    <ul className="text-xs text-slate-600 space-y-1">
                      {atsResult.suggestions.map((s, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-blue-500 flex-shrink-0">&rarr;</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Jobs</h2>
            {recentJobs.length === 0 ? (
              <p className="text-slate-400 text-sm">No saved jobs yet. Use the Chrome extension to save jobs.</p>
            ) : (
              <div className="space-y-3">
                {recentJobs.map((job: any) => (
                  <div key={job.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <div className="font-medium text-sm text-slate-900">{job.title}</div>
                      <div className="text-xs text-slate-400">{job.company} &middot; {job.source}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      job.status === "applied" ? "bg-blue-50 text-blue-700" :
                      job.status === "offer" ? "bg-green-50 text-green-700" :
                      job.status === "rejected" ? "bg-red-50 text-red-700" :
                      "bg-slate-50 text-slate-600"
                    }`}>
                      {job.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link href="/dashboard/resumes" className="block w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg text-center hover:from-blue-700 hover:to-blue-800 transition-all">
                Upload Resume
              </Link>
              <div className="grid grid-cols-3 gap-2">
                <a href="https://www.linkedin.com/jobs/" target="_blank" rel="noopener" className="block w-full py-2.5 px-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg text-center hover:bg-slate-50 transition-all text-xs">
                  LinkedIn
                </a>
                <a href="https://internshala.com/jobs/" target="_blank" rel="noopener" className="block w-full py-2.5 px-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg text-center hover:bg-slate-50 transition-all text-xs">
                  Internshala
                </a>
                <a href="https://www.naukri.com/jobs" target="_blank" rel="noopener" className="block w-full py-2.5 px-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg text-center hover:bg-slate-50 transition-all text-xs">
                  Naukri
                </a>
              </div>
              <Link href="/dashboard/jobs" className="block w-full py-3 px-4 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg text-center hover:bg-slate-50 transition-all">
                View Job Tracker
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
