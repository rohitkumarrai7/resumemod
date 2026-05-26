"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { PageHeader, EmptyState, Button, Card, SpinnerCenter } from "@/components/ui";

interface Template {
  _id: string;
  name: string;
  slug: string;
  category: string;
  engine: string;
  colors?: string[];
  fonts?: string[];
  spacing?: string;
  sectionOrder?: string[];
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [seeding, setSeeding] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("rf_preferred_template");
    if (saved) setSelectedSlug(saved);
  }, []);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const data = await api.templates.list(filter !== "all" ? filter : undefined);
      setTemplates(data.templates || []);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, [filter]);

  async function seedTemplates() {
    setSeeding(true);
    try {
      await api.templates.seed();
      await loadTemplates();
    } catch (err) {
      console.error("Failed to seed:", err);
    } finally {
      setSeeding(false);
    }
  }

  function useTemplate(template: Template) {
    localStorage.setItem("rf_preferred_template", template.slug);
    setSelectedSlug(template.slug);
    router.push("/dashboard/resumes");
  }

  if (loading) return <SpinnerCenter />;

  return (
    <div>
      <PageHeader
        title="Templates"
        subtitle="Choose a template for your resume"
        action={
          templates.length === 0 ? (
            <Button onClick={seedTemplates} loading={seeding} disabled={seeding}>
              Load Templates
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-2 mb-6">
        {["all", "ats", "design"].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-4 py-2 rounded-button text-sm font-medium capitalize ${
              filter === cat
                ? "bg-primary text-white"
                : "bg-surface border border-border text-muted hover:bg-slate-50"
            }`}
          >
            {cat === "all" ? "All" : cat === "ats" ? "ATS-Optimized" : "Design-Forward"}
          </button>
        ))}
      </div>

      {templates.length === 0 ? (
        <Card>
          <EmptyState
            title="No templates yet"
            description='Click "Load Templates" to get started.'
            icon="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((t) => (
            <div
              key={t._id}
              className="bg-white rounded-xl border border-slate-100 overflow-hidden hover:shadow-lg transition-shadow group"
            >
              {/* Template preview */}
              <div
                className="h-48 relative flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${t.colors?.[0] || "#075985"} 0%, ${t.colors?.[1] || "#0369A1"} 100%)`,
                }}
              >
                <div className="bg-white rounded-lg shadow-xl w-24 h-32 p-2 transform group-hover:scale-105 transition-transform">
                  <div className="space-y-1">
                    <div className="h-1.5 rounded-full w-12 mx-auto" style={{ background: t.colors?.[1] || "#2563EB" }} />
                    <div className="h-0.5 bg-slate-200 rounded-full w-16 mx-auto" />
                    <div className="h-0.5 bg-slate-200 rounded-full w-14 mx-auto" />
                    <div className="mt-1.5 h-0.5 bg-slate-100 rounded-full" />
                    <div className="h-0.5 bg-slate-100 rounded-full w-16" />
                    <div className="h-0.5 bg-slate-100 rounded-full w-12" />
                    <div className="mt-1.5 h-0.5 bg-slate-100 rounded-full" />
                    <div className="h-0.5 bg-slate-100 rounded-full w-14" />
                    <div className="h-0.5 bg-slate-100 rounded-full w-10" />
                  </div>
                </div>
                <div className="absolute top-3 right-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    t.category === "ats"
                      ? "bg-emerald-500/20 text-emerald-200"
                      : "bg-purple-500/20 text-purple-200"
                  }`}>
                    {t.category === "ats" ? "ATS Safe" : "Design"}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-slate-900">{t.name}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-slate-500 capitalize">{t.engine}</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-xs text-slate-500 capitalize">{t.spacing}</span>
                  {t.fonts && t.fonts.length > 0 && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span className="text-xs text-slate-500">{t.fonts[0]}</span>
                    </>
                  )}
                </div>
                <button
                  onClick={() => useTemplate(t)}
                  className={`mt-3 w-full py-2 text-sm font-medium rounded-lg transition-colors ${
                    selectedSlug === t.slug
                      ? "bg-primary text-white hover:bg-primary-hover"
                      : "bg-surface border border-border text-foreground hover:bg-slate-50"
                  }`}
                >
                  {selectedSlug === t.slug ? "Selected" : "Use Template"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
