"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, StatCard, Card, SpinnerCenter } from "@/components/ui";

interface Stats {
  totalJobs: number;
  totalResumes: number;
  avgScore: number;
  topScore: number;
  jobsByStage: Record<string, number>;
  jobsBySource: Record<string, number>;
  scoreHistory: number[];
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats>({
    totalJobs: 0,
    totalResumes: 0,
    avgScore: 0,
    topScore: 0,
    jobsByStage: {},
    jobsBySource: {},
    scoreHistory: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    let jobs: any[] = [];
    let resumes: any[] = [];
    try {
      const jobsData = await api.jobs.list();
      jobs = jobsData.jobs || [];
    } catch (err) {
      console.error("Failed to load jobs for analytics:", err);
    }
    try {
      const resumesData = await api.resumes.list();
      resumes = resumesData.resumes || [];
    } catch (err) {
      console.error("Failed to load resumes for analytics:", err);
    }

    const scores = jobs
      .filter((j: any) => j.atsScore != null)
      .map((j: any) => j.atsScore as number);

    const resumeScores = resumes
      .filter((r: any) => r.lastAtsScore != null)
      .map((r: any) => r.lastAtsScore as number);

    const allScores = [...scores, ...resumeScores];

    const byStage: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    jobs.forEach((j: any) => {
      const stage = j.stage || j.status || "wishlist";
      byStage[stage] = (byStage[stage] || 0) + 1;
      const src = j.source || "other";
      bySource[src] = (bySource[src] || 0) + 1;
    });

    setStats({
      totalJobs: jobs.length,
      totalResumes: resumes.length,
      avgScore: allScores.length > 0 ? Math.round(allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length) : 0,
      topScore: allScores.length > 0 ? Math.max(...allScores) : 0,
      jobsByStage: byStage,
      jobsBySource: bySource,
      scoreHistory: allScores.slice(0, 20),
    });
    setLoading(false);
  }

  if (loading) return <SpinnerCenter />;

  const stageColors: Record<string, string> = {
    wishlist: "bg-slate-400", saved: "bg-slate-400",
    tailored: "bg-accent-500",
    applied: "bg-primary-500",
    screening: "bg-cyan-500", phone_screen: "bg-cyan-500",
    interview: "bg-amber-500", technical: "bg-amber-500", onsite: "bg-amber-500",
    offer: "bg-emerald-500",
    rejected: "bg-red-500",
  };

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Your job search performance" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard label="Total Jobs" value={stats.totalJobs} />
        <StatCard label="Resumes" value={stats.totalResumes} />
        <StatCard label="Avg ATS Score" value={stats.avgScore > 0 ? stats.avgScore : "—"} />
        <StatCard label="Top Score" value={stats.topScore > 0 ? stats.topScore : "—"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Pipeline funnel */}
        <Card>
          <h2 className="text-lg font-bold text-foreground mb-4">Application Pipeline</h2>
          <div className="space-y-3">
            {Object.entries(stats.jobsByStage)
              .sort(([, a], [, b]) => b - a)
              .map(([stage, count]) => {
                const maxCount = Math.max(...Object.values(stats.jobsByStage));
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <div className="w-24 text-sm text-slate-600 capitalize">{stage.replace("_", " ")}</div>
                    <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${stageColors[stage] || "bg-slate-400"} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-8 text-sm font-semibold text-slate-700 text-right">{count}</div>
                  </div>
                );
              })}
          </div>
          {Object.keys(stats.jobsByStage).length === 0 && (
            <p className="text-center text-slate-400 py-8">No pipeline data yet</p>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-foreground mb-4">Jobs by Source</h2>
          <div className="space-y-3">
            {Object.entries(stats.jobsBySource)
              .sort(([, a], [, b]) => b - a)
              .map(([source, count]) => {
                const maxCount = Math.max(...Object.values(stats.jobsBySource));
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <div key={source} className="flex items-center gap-3">
                    <div className="w-24 text-sm text-slate-600 capitalize">{source}</div>
                    <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="w-8 text-sm font-semibold text-slate-700 text-right">{count}</div>
                  </div>
                );
              })}
          </div>
          {Object.keys(stats.jobsBySource).length === 0 && (
            <p className="text-center text-slate-400 py-8">No source data yet</p>
          )}
        </Card>
      </div>

      {stats.scoreHistory.length > 0 && (
        <Card>
          <h2 className="text-lg font-bold text-foreground mb-4">Recent ATS Scores</h2>
          <div className="flex items-end gap-1 h-32">
            {stats.scoreHistory.map((score, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end">
                <div
                  className={`w-full rounded-t transition-all ${
                    score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500"
                  }`}
                  style={{ height: `${score}%` }}
                  title={`${score}%`}
                />
                <span className="text-xs text-slate-400 mt-1">{score}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
