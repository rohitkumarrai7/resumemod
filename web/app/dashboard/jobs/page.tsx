"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, EmptyState, Button, Card, SpinnerCenter } from "@/components/ui";

const STAGES = [
  { key: "wishlist", label: "Wishlist", color: "bg-slate-500" },
  { key: "tailored", label: "Tailored", color: "bg-accent-500" },
  { key: "applied", label: "Applied", color: "bg-primary-500" },
  { key: "screening", label: "Screening", color: "bg-cyan-500" },
  { key: "interview", label: "Interview", color: "bg-amber-500" },
  { key: "offer", label: "Offer", color: "bg-emerald-500" },
  { key: "rejected", label: "Rejected", color: "bg-red-500" },
] as const;

type Stage = typeof STAGES[number]["key"];

const STATUS_TO_STAGE: Record<string, Stage> = {
  saved: "wishlist",
  applied: "applied",
  phone_screen: "screening",
  technical: "interview",
  onsite: "interview",
  offer: "offer",
  rejected: "rejected",
};

interface Job {
  id: string;
  title: string;
  company?: string;
  location?: string;
  source?: string;
  status: string;
  stage?: string;
  notes?: string;
  salary?: string;
  atsScore?: number;
  appliedAt?: number;
  _creationTime?: number;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [dragging, setDragging] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    try {
      const data = await api.jobs.list();
      setJobs(data.jobs || []);
    } catch (err) {
      console.error("Failed to load jobs:", err);
    } finally {
      setLoading(false);
    }
  }

  function getJobStage(job: Job): Stage {
    if (job.stage && STAGES.some((s) => s.key === job.stage)) return job.stage as Stage;
    return STATUS_TO_STAGE[job.status] || "wishlist";
  }

  function getJobsByStage(stage: Stage) {
    return jobs.filter((j) => getJobStage(j) === stage);
  }

  async function moveJob(jobId: string, newStage: Stage) {
    try {
      await api.jobs.update(jobId, { stage: newStage, status: newStage });
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: newStage, stage: newStage } : j))
      );
    } catch (err) {
      console.error("Failed to move job:", err);
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

  async function saveNotes(jobId: string) {
    try {
      await api.jobs.update(jobId, { notes: editNotes });
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, notes: editNotes } : j)));
      setEditingJob(null);
    } catch (err) {
      console.error("Failed to save notes:", err);
    }
  }

  function handleDragStart(jobId: string) {
    setDragging(jobId);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.currentTarget.classList.add("ring-2", "ring-primary/30");
  }

  function handleDragLeave(e: React.DragEvent) {
    e.currentTarget.classList.remove("ring-2", "ring-primary/30");
  }

  function handleDrop(e: React.DragEvent, stage: Stage) {
    e.preventDefault();
    e.currentTarget.classList.remove("ring-2", "ring-primary/30");
    if (dragging) {
      moveJob(dragging, stage);
      setDragging(null);
    }
  }

  if (loading) return <SpinnerCenter />;

  return (
    <div>
      <PageHeader
        title="Job Tracker"
        subtitle={`${jobs.length} jobs across ${STAGES.length} stages`}
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant={viewMode === "kanban" ? "primary" : "secondary"} onClick={() => setViewMode("kanban")}>Kanban</Button>
            <Button size="sm" variant={viewMode === "list" ? "primary" : "secondary"} onClick={() => setViewMode("list")}>List</Button>
          </div>
        }
      />

      {jobs.length === 0 ? (
        <Card>
          <EmptyState
            title="No jobs tracked yet"
            description="Save jobs from the Chrome extension while browsing LinkedIn, or tailor a resume to auto-add a job at the Tailored stage."
            icon="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </Card>
      ) : (
        <>
      {/* Kanban View */}
      {viewMode === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "calc(100vh - 200px)" }}>
          {STAGES.map((stage) => {
            const stageJobs = getJobsByStage(stage.key);
            return (
              <div
                key={stage.key}
                className="flex-shrink-0 w-72 bg-slate-50 rounded-xl border border-slate-100 flex flex-col transition-all"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.key)}
              >
                <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                    <span className="text-sm font-semibold text-slate-700">{stage.label}</span>
                  </div>
                  <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full font-medium">
                    {stageJobs.length}
                  </span>
                </div>
                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {stageJobs.length === 0 ? (
                    <div className="text-center py-8 text-slate-300 text-xs">
                      Drop jobs here
                    </div>
                  ) : (
                    stageJobs.map((job) => (
                      <div
                        key={job.id}
                        draggable
                        onDragStart={() => handleDragStart(job.id)}
                        className={`bg-white rounded-lg p-3 border border-slate-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group ${
                          dragging === job.id ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-slate-900 truncate">{job.title}</div>
                            <div className="text-xs text-slate-500 mt-0.5 truncate">
                              {job.company}{job.location ? ` · ${job.location}` : ""}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteJob(job.id)}
                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        {job.source && (
                          <span className="text-xs px-1.5 py-0.5 bg-slate-50 text-slate-400 rounded mt-1.5 inline-block">
                            {job.source}
                          </span>
                        )}
                        {job.atsScore != null && (
                          <span className={`text-xs px-1.5 py-0.5 rounded mt-1.5 ml-1 inline-block font-semibold ${
                            job.atsScore >= 75 ? "bg-emerald-50 text-emerald-700" :
                            job.atsScore >= 50 ? "bg-amber-50 text-amber-700" :
                            "bg-red-50 text-red-700"
                          }`}>
                            ATS {job.atsScore}
                          </span>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <button
                            onClick={() => { setEditingJob(job); setEditNotes(job.notes || ""); }}
                            className="text-xs text-primary hover:text-primary-hover"
                          >
                            {job.notes ? "Edit notes" : "Add notes"}
                          </button>
                          {job.salary && <span className="text-xs text-emerald-600 font-medium">{job.salary}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="space-y-2">
          {jobs.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-slate-100">
              <p className="text-slate-400">No jobs yet. Use the Chrome extension to save jobs.</p>
            </div>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900">{job.title}</div>
                  <div className="text-sm text-slate-500 mt-0.5">
                    {job.company}{job.location ? ` · ${job.location}` : ""}{job.source ? ` · via ${job.source}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={getJobStage(job)}
                    onChange={(e) => moveJob(job.id, e.target.value as Stage)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:ring-1 focus:ring-primary outline-none"
                  >
                    {STAGES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                  <button onClick={() => deleteJob(job.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      </>
      )}

      {/* Notes Modal */}
      {editingJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingJob(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900 mb-1">{editingJob.title}</h3>
            <p className="text-sm text-slate-500 mb-4">{editingJob.company}</p>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={5}
              placeholder="Add notes about this application..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-y"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditingJob(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
                Cancel
              </button>
              <button
                onClick={() => saveNotes(editingJob.id)}
                className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-button hover:bg-primary-hover"
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
