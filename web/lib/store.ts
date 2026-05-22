import { create } from "zustand";

export interface Suggestion {
  id: string;
  description: string;
  section: string;
  applied: boolean;
}

function isValidResumeText(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  if (text.startsWith("JVBERi0") || text.startsWith("iVBORw0K")) return false;
  const pdfMarkers = ["%PDF", "PDF-1.", "/Linearized", "/Type /XRef", "/Type /Catalog", "endobj", "endstream", "<< /", "obj<<", "streamx", "/Filter /FlateDecode", "\\documentclass"];
  if (pdfMarkers.some((m) => text.includes(m))) return false;
  const binaryCount = (text.match(/[^\x20-\x7E\t\n\r]/g) || []).length;
  if (text.length > 0 && binaryCount / text.length > 0.2) return false;
  return text.length >= 50;
}

interface EditorState {
  draftId: string | null;
  latexSource: string;
  pdfUrl: string | null;
  isCompiling: boolean;
  atsScore: number | null;
  missingKeywords: string[];
  matchedKeywords: string[];
  suggestions: Suggestion[];
  jobTitle: string | null;
  companyName: string | null;
  autoCompile: boolean;
  lastCompiledSource: string;
  resumeTextExternal: string;

  setDraftId: (id: string) => void;
  setLatexSource: (source: string) => void;
  setPdfUrl: (url: string | null) => void;
  setIsCompiling: (v: boolean) => void;
  setAtsScore: (score: number | null) => void;
  setMissingKeywords: (kws: string[]) => void;
  setMatchedKeywords: (kws: string[]) => void;
  setAutoCompile: (v: boolean) => void;
  setLastCompiledSource: (s: string) => void;
  setResumeTextExternal: (s: string) => void;
  loadDraft: (draftId: string) => Promise<void>;
  optimizeWithLLM: () => Promise<any>;
  compile: () => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  draftId: null,
  latexSource: "",
  pdfUrl: null,
  isCompiling: false,
  atsScore: null,
  missingKeywords: [],
  matchedKeywords: [],
  suggestions: [],
  jobTitle: null,
  companyName: null,
  autoCompile: true,
  lastCompiledSource: "",
  resumeTextExternal: "",

  setDraftId: (id) => set({ draftId: id }),
  setLatexSource: (source) => set({ latexSource: source }),
  setPdfUrl: (url) => set({ pdfUrl: url }),
  setIsCompiling: (v) => set({ isCompiling: v }),
  setAtsScore: (score) => set({ atsScore: score }),
  setMissingKeywords: (kws) => set({ missingKeywords: kws }),
  setMatchedKeywords: (kws) => set({ matchedKeywords: kws }),
  setAutoCompile: (v) => set({ autoCompile: v }),
  setLastCompiledSource: (s) => set({ lastCompiledSource: s }),
  setResumeTextExternal: (s) => set({ resumeTextExternal: s }),

  loadDraft: async (draftId: string) => {
    set({ draftId });
    try {
      const { api } = await import("./api");
      const data = await api.drafts.get(draftId);

      if (data.latexSource) {
        set({ latexSource: data.latexSource });
      }
      if (data.currentAtsScore != null) {
        set({ atsScore: data.currentAtsScore });
      }
      if (data.compiledPdfUrl) {
        set({ pdfUrl: data.compiledPdfUrl });
      }
      if (data.context?.job?.title) {
        set({ jobTitle: data.context.job.title });
      }
      if (data.context?.job?.company) {
        set({ companyName: data.context.job.company });
      }
      if (data.context?.analysis?.gapAnalysis?.missingKeywords) {
        set({ missingKeywords: data.context.analysis.gapAnalysis.missingKeywords });
      }
      if (data.context?.analysis?.gapAnalysis?.matchedKeywords) {
        set({ matchedKeywords: data.context.analysis.gapAnalysis.matchedKeywords });
      }
      if (data.context?.analysis?.gapAnalysis?.resumeOriginalText) {
        set({ resumeTextExternal: data.context.analysis.gapAnalysis.resumeOriginalText });
      }
      if (data.status === "ready") {
        return;
      }
      if (data.status === "optimizing") {
        const poll = async () => {
          try {
            const d = await api.drafts.get(draftId);
            if (d.status === "ready") {
              set({
                latexSource: d.latexSource || get().latexSource,
                atsScore: d.currentAtsScore,
                pdfUrl: d.compiledPdfUrl,
              });
              return;
            }
            setTimeout(poll, 2000);
          } catch {
            setTimeout(poll, 3000);
          }
        };
        setTimeout(poll, 2000);
      }
    } catch (err) {
      console.error("Failed to load draft:", err);
    }
  },

  optimizeWithLLM: async () => {
    const { draftId, latexSource: currentLatex, resumeTextExternal } = get();
    if (!draftId) return;
    try {
      const { api } = await import("./api");
      const data = await api.drafts.get(draftId);

      const jd = data.context?.job?.description || "";
      const apiResumeText = data.context?.resume?.rawText
        || data.context?.resume?.textPreview
        || data.context?.analysis?.gapAnalysis?.resumeOriginalText
        || "";
      const resumeText = isValidResumeText(apiResumeText) ? apiResumeText : resumeTextExternal;
      const gapAnalysis = data.context?.analysis?.gapAnalysis || {};

      if (!resumeText || resumeText.length < 20) {
        console.warn("No valid resume text found for LLM optimization");
      }

      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          currentLatex,
          jobDescription: jd,
          jobTitle: data.context?.job?.title || "",
          company: data.context?.job?.company || "",
          source: data.context?.job?.source || "",
          matchedKeywords: gapAnalysis.matchedKeywords || [],
          missingKeywords: gapAnalysis.missingKeywords || [],
          suggestions: gapAnalysis.suggestions || [],
        }),
      });

      const result = await res.json();
      if (result.latexSource) {
        set({ latexSource: result.latexSource });
      }
      return result;
    } catch (err) {
      console.error("LLM optimize failed:", err);
      return null;
    }
  },

  compile: async () => {
    const { draftId, latexSource, lastCompiledSource } = get();
    if (!draftId || !latexSource) return;
    if (latexSource === lastCompiledSource) return;

    set({ isCompiling: true });
    try {
      const { api } = await import("./api");
      const data = await api.drafts.compile(draftId, latexSource);
      if (data.success) {
        set({
          pdfUrl: data.pdfUrl || null,
          atsScore: data.atsScore,
          missingKeywords: data.missingKeywords || [],
          matchedKeywords: data.matchedKeywords || [],
          lastCompiledSource: latexSource,
        });
      }
    } catch (err) {
      console.error("Compile failed:", err);
    } finally {
      set({ isCompiling: false });
    }
  },
}));
