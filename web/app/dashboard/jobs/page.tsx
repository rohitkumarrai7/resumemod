"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const STATUSES = ["saved", "applied", "phone_screen", "technical", "onsite", "offer", "rejected"] as const;
const STATUS_LABELS: Record<string, string> = {
  saved: "Saved",
  applied: "Applied",
  phone_screen: "Phone Screen",
  technical: "Technical",
  onsite: "Onsite",
  offer: "Offer",
  rejected: "Rejected",
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    try {
      const data = await api.jobs.list(filter !== "all" ? { status: filter } : undefined);
      setJobs(data.jobs || []);
    } catch (err) {
      console.error("Failed to load jobs:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadJobs(); }, [filter]);

  async function updateStatus(jobId: string, status: string) {
    try {
      await api.jobs.update(jobId, { status });
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)));
    } catch (err) {
      console.error("Failed to update:", err);
    }
  }

  async function deleteJob(jobId: string) {
    try {
      await api.jobs.delete(jobId);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Job Tracker</h1>
          <p className="text-slate-500 mt-1">{jobs.length} jobs</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button onClick={() => setFilter("all")} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${filter === "all" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
          All ({jobs.length})
        </button>
        {STATUSES.map((s) => {
          const count = jobs.filter((j) => j.status === s).length;
          return (
            <button key={s} onClick={() => setFilter(s)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${filter === s ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {STATUS_LABELS[s]} ({count})
            </button>
          );
        })}
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-100">
          <p className="text-slate-400">No jobs yet. Use the Chrome extension to save jobs from LinkedIn, Indeed, and more.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900">{job.title}</div>
                <div className="text-sm text-slate-500 mt-0.5">
                  {job.company}{job.location ? ` · ${job.location}` : ""}
                  {job.source ? ` · via ${job.source}` : ""}
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(job.id, s)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                        job.status === s
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => deleteJob(job.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
