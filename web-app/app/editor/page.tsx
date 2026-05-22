'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Editor from '@monaco-editor/react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const API_BASE = 'https://stoic-caiman-320.convex.site';

interface GapAnalysis {
  missingKeywords: string[];
  matchedKeywords: string[];
  suggestions: string[];
  optimizedKeywords: string[];
  resumeOriginalText?: string;
  localSuggestions?: any[];
}

interface DraftContext {
  draftId: string;
  status: string;
  context: {
    resume: {
      id: string;
      structuredData?: any;
      rawText?: string;
      textPreview?: string;
    } | null;
    job: {
      title: string;
      company: string;
      description: string;
      location?: string;
      source?: string;
    } | null;
    analysis: {
      initialScore: number;
      currentScore: number;
      gapAnalysis: GapAnalysis;
    };
    optimization: {
      latexSource: string;
      changes: string[];
      predictedScore: number;
    };
  };
  latexSource?: string;
  currentAtsScore?: number;
  initialScore?: number;
  expiresAt?: number;
  resumeOriginalText?: string;
  jobDescription?: string;
  jobTitle?: string;
  company?: string;
}

function generatePlaceholderLatex(resumeText: string, jobTitle: string, company: string, missingKw: string[]): string {
  const lines = resumeText.split('\n').filter(l => l.trim());
  let name = '';
  const sections: { heading: string; lines: string[] }[] = [];
  let currentSection: { heading: string; lines: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!name && trimmed.length > 2 && trimmed.length < 60 && /^[A-Z]/.test(trimmed) && !/[@|:;,]/.test(trimmed) && !currentSection) {
      name = trimmed;
      continue;
    }
    if (/^(summary|objective|about|profile|professional|experience|employment|work|education|academic|skills|technologies|projects|certifications)/i.test(trimmed) && trimmed.length < 40) {
      currentSection = { heading: trimmed.charAt(0).toUpperCase() + trimmed.slice(1), lines: [] };
      sections.push(currentSection);
      continue;
    }
    if (currentSection) {
      currentSection.lines.push(trimmed);
    } else {
      currentSection = { heading: 'Summary', lines: [trimmed] };
      sections.push(currentSection);
    }
  }

  if (sections.length === 0) {
    sections.push({ heading: 'Summary', lines: [resumeText.slice(0, 500)] });
  }

  const escLatex = (s: string) =>
    s.replace(/\\/g, '\\textbackslash{}')
     .replace(/[&%$#_{}]/g, (c) => `\\${c}`)
     .replace(/~/g, '\\textasciitilde{}')
     .replace(/\^/g, '\\textasciicircum{}');

  const skillsSection = sections.find(s => /skills|technologies/i.test(s.heading));
  const allSkills = skillsSection
    ? skillsSection.lines.join(', ').split(/[,&|]/).map(s => s.trim()).filter(Boolean)
    : [];
  const optimizedSkills = Array.from(new Set([...allSkills, ...missingKw.slice(0, 8)]));

  let latex = `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[margin=0.75in]{geometry}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{xcolor}
\\usepackage{hyperref}

\\definecolor{accent}{HTML}{2563EB}
\\definecolor{heading}{HTML}{1E3A5F}

\\titleformat{\\section}{\\large\\bfseries\\color{heading}}{}{0em}{}[\\titlerule]
\\titlespacing{\\section}{0pt}{8pt}{4pt}

\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{2pt}

\\begin{document}

\\begin{center}
  {\\LARGE\\bfseries ${escLatex(name || 'Your Name')}}\\\\[4pt]
\\end{center}

`;

  for (const sec of sections) {
    if (/skills|technologies/i.test(sec.heading)) {
      latex += `\\section{${escLatex(sec.heading)}}\n`;
      latex += `  ${optimizedSkills.map(s => escLatex(s)).join(', ')}\n\n`;
    } else if (sec.lines.length > 0) {
      latex += `\\section{${escLatex(sec.heading)}}\n`;
      if (sec.lines.length === 1 && sec.lines[0].length > 80) {
        latex += `${escLatex(sec.lines[0])}\n\n`;
      } else {
        latex += `\\begin{itemize}[leftmargin=*,itemsep=2pt]\n`;
        for (const line of sec.lines) {
          latex += `  \\item ${escLatex(line)}\n`;
        }
        latex += `\\end{itemize}\n\n`;
      }
    }
  }

  latex += `\\end{document}\n`;
  return latex;
}

function EditorContent() {
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draft');
  const urlJobTitle = searchParams.get('jobTitle') || '';
  const urlCompany = searchParams.get('company') || '';
  const urlScore = searchParams.get('score') || '';
  const urlResumeText = searchParams.get('resumeText') || '';
  const urlMatchedKw = (searchParams.get('matchedKeywords') || '').split(',').filter(Boolean);
  const urlMissingKw = (searchParams.get('missingKeywords') || '').split(',').filter(Boolean);

  const [draft, setDraft] = useState<DraftContext | null>(null);
  const [latexSource, setLatexSource] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [atsScore, setAtsScore] = useState<number | null>(null);
  const [missingKeywords, setMissingKeywords] = useState<string[]>([]);
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'preview' | 'analysis' | 'context'>('preview');

  const resumeText = draft?.resumeOriginalText
    || draft?.context?.analysis?.gapAnalysis?.resumeOriginalText
    || draft?.context?.resume?.rawText
    || draft?.context?.resume?.textPreview
    || urlResumeText
    || '';

  const jobDescription = draft?.jobDescription
    || draft?.context?.job?.description
    || '';

  const jobTitle = draft?.jobTitle
    || draft?.context?.job?.title
    || urlJobTitle
    || '';

  const company = draft?.company
    || draft?.context?.job?.company
    || urlCompany
    || '';

  useEffect(() => {
    if (draftId) {
      fetchDraft(draftId);
    } else if (urlResumeText || urlJobTitle) {
      setAtsScore(parseInt(urlScore) || 0);
      if (urlMissingKw.length) setMissingKeywords(urlMissingKw);
      if (urlMatchedKw.length) setMatchedKeywords(urlMatchedKw);
      if (urlResumeText) {
        const generatedLatex = generatePlaceholderLatex(urlResumeText, urlJobTitle, urlCompany, urlMissingKw);
        setLatexSource(generatedLatex);
      }
    } else {
      setError('No draft ID provided. Open this page from the ResumeForge extension.');
    }
  }, [draftId]);

  const fetchDraft = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/v1/drafts/${id}`, {
        headers: {
          'Authorization': 'Bearer ' + (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '')
        }
      });

      if (!res.ok) throw new Error('Failed to load draft');

      const data = await res.json();
      setDraft(data);
      setLatexSource(data.latexSource || data.context?.optimization?.latexSource || '');
      setAtsScore(data.currentAtsScore || data.initialScore || 0);

      const ga = data.context?.analysis?.gapAnalysis || {};
      setMissingKeywords(ga.missingKeywords || []);
      setMatchedKeywords(ga.matchedKeywords || []);
      setSuggestions(ga.suggestions || ga.localSuggestions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const compile = useCallback(async () => {
    if (!draftId || !latexSource) return;
    setIsCompiling(true);
    try {
      const res = await fetch(`${API_BASE}/v1/drafts/${draftId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '')
        },
        body: JSON.stringify({ latexSource })
      });

      const data = await res.json();
      if (data.success !== false) {
        if (data.pdfUrl) setPdfUrl(data.pdfUrl);
        if (data.atsScore !== undefined) setAtsScore(data.atsScore);
        if (data.missingKeywords) setMissingKeywords(data.missingKeywords);
        if (data.matchedKeywords) setMatchedKeywords(data.matchedKeywords);
        if (data.suggestions) setSuggestions(data.suggestions.map((s: any) => typeof s === 'string' ? s : s.message || ''));
      }
    } catch (err) {
      console.error('Compile failed:', err);
    } finally {
      setIsCompiling(false);
    }
  }, [draftId, latexSource]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (latexSource && latexSource.length > 100 && draftId) {
        compile();
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [latexSource, compile, draftId]);

  const handleAiRequest = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);

    try {
      const prompt = aiInput.trim();
      const contextBlock = [
        '=== ORIGINAL RESUME TEXT ===',
        resumeText.slice(0, 8000) || '(No resume text available)',
        '',
        '=== JOB DESCRIPTION ===',
        jobDescription.slice(0, 4000) || '(No job description available)',
        '',
        '=== JOB TITLE ===',
        jobTitle || '(Unknown)',
        '=== COMPANY ===',
        company || '(Unknown)',
        '',
        '=== CURRENT LATEX SOURCE ===',
        latexSource.slice(0, 6000) || '(Empty)',
        '',
        '=== ATS ANALYSIS ===',
        `Current Score: ${atsScore || 0}/100`,
        `Missing Keywords: ${missingKeywords.join(', ') || 'None'}`,
        `Matched Keywords: ${matchedKeywords.join(', ') || 'None'}`,
        `Suggestions: ${suggestions.join('; ') || 'None'}`,
        '',
        '=== USER REQUEST ===',
        prompt,
      ].join('\n');

      const messages = [
        {
          role: 'system' as const,
          content: 'You are an expert resume writer and LaTeX specialist. You modify the LaTeX resume source to better match the job description while keeping ALL information truthful to the original resume. Never invent experiences, skills, or qualifications the candidate does not have. Return ONLY the complete modified LaTeX source code, nothing else. Make sure the LaTeX is valid and compiles correctly.'
        },
        {
          role: 'user' as const,
          content: contextBlock
        }
      ];

      const llmRes = await fetch('https://stoic-caiman-320.convex.site/v1/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, maxTokens: 4096 })
      });

      if (!llmRes.ok) {
        const fallbackLatex = applySimpleOptimization(latexSource, missingKeywords, prompt);
        if (fallbackLatex !== latexSource) {
          setLatexSource(fallbackLatex);
        }
        setAiLoading(false);
        setAiInput('');
        return;
      }

      const llmData = await llmRes.json();
      const generated = llmData.content || llmData.text || '';

      if (generated.includes('\\documentclass') || generated.includes('\\begin{document}')) {
        const latexMatch = generated.match(/\\documentclass[\s\S]*\\end\{document\}/);
        setLatexSource(latexMatch ? latexMatch[0] : generated);
      } else if (generated.trim()) {
        const latexMatch = generated.match(/```(?:latex)?\s*([\s\S]*?)```/);
        if (latexMatch) {
          setLatexSource(latexMatch[1].trim());
        }
      }
    } catch (err) {
      console.error('AI request failed:', err);
    } finally {
      setAiLoading(false);
      setAiInput('');
    }
  };

  const downloadPdf = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  if (error) return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-red-600 text-lg font-semibold mb-2">Error</div>
        <div className="text-slate-600 text-sm">{error}</div>
      </div>
    </div>
  );

  if (!draft && !urlResumeText && draftId) return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-slate-500">Loading draft...</div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold">ResumeForge Editor</h1>
          <p className="text-sm text-slate-400">
            {jobTitle ? `${jobTitle}` : 'Resume'} {company ? `@ ${company}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {atsScore !== null && (
            <div className={`px-3 py-1 rounded-full text-sm font-bold ${
              atsScore >= 75 ? 'bg-green-500' :
              atsScore >= 50 ? 'bg-yellow-500 text-slate-900' : 'bg-red-500'
            }`}>
              ATS: {atsScore}/100
            </div>
          )}
          <button
            onClick={compile}
            disabled={isCompiling || !draftId}
            className="px-4 py-2 bg-blue-600 rounded-lg font-medium disabled:opacity-50 cursor-pointer text-sm"
          >
            {isCompiling ? 'Compiling...' : 'Compile'}
          </button>
          <button
            onClick={downloadPdf}
            disabled={!pdfUrl}
            className="px-4 py-2 bg-green-600 rounded-lg font-medium disabled:opacity-50 cursor-pointer text-sm"
          >
            Download PDF
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 flex flex-col border-r border-slate-200">
          <div className="bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 flex justify-between items-center">
            <span>LaTeX Source</span>
            {resumeText && (
              <span className="text-xs text-slate-500">
                Resume: {resumeText.length} chars loaded
              </span>
            )}
          </div>
          <div className="flex-1">
            <Editor
              height="100%"
              defaultLanguage="latex"
              value={latexSource}
              onChange={(value) => setLatexSource(value || '')}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
              }}
            />
          </div>
        </div>

        <div className="w-1/2 flex flex-col">
          <div className="flex border-b border-slate-200 bg-white">
            {(['preview', 'analysis', 'context'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveRightTab(tab)}
                className={`flex-1 px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${
                  activeRightTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab === 'preview' ? 'PDF Preview' : tab === 'analysis' ? 'Analysis' : 'Context Data'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto">
            {activeRightTab === 'preview' && (
              <div className="p-4 bg-slate-100 min-h-full">
                {pdfUrl ? (
                  <div className="bg-white shadow-lg mx-auto" style={{ width: 'fit-content' }}>
                    <Document file={pdfUrl}>
                      <Page pageNumber={1} width={500} />
                    </Document>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-slate-400">
                    {isCompiling ? 'Compiling PDF...' : 'Click Compile to generate PDF preview'}
                  </div>
                )}
              </div>
            )}

            {activeRightTab === 'analysis' && (
              <div className="p-4 space-y-4">
                {missingKeywords && missingKeywords.length > 0 && (
                  <div>
                    <p className="text-sm text-red-600 font-semibold mb-2">
                      Missing Keywords ({missingKeywords.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {missingKeywords.map((kw: string) => (
                        <span key={kw} className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-full border border-red-200">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {matchedKeywords && matchedKeywords.length > 0 && (
                  <div>
                    <p className="text-sm text-green-600 font-semibold mb-2">
                      Matched Keywords ({matchedKeywords.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {matchedKeywords.map((kw: string) => (
                        <span key={kw} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full border border-green-200">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {suggestions && suggestions.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-700 font-semibold mb-2">Suggestions</p>
                    <ul className="space-y-2">
                      {suggestions.map((s: string, i: number) => (
                        <li key={i} className="text-sm text-slate-600 pl-4 border-l-2 border-blue-400">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="text-sm text-slate-500 border-t pt-4 mt-4 space-y-1">
                  <p><strong>Job:</strong> {jobTitle || 'Unknown'}</p>
                  <p><strong>Company:</strong> {company || 'Unknown'}</p>
                  {jobDescription && (
                    <p className="mt-2"><strong>JD Excerpt:</strong> {jobDescription.slice(0, 300)}...</p>
                  )}
                </div>
              </div>
            )}

            {activeRightTab === 'context' && (
              <div className="p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">
                    Original Resume Text ({resumeText.length} chars)
                  </h3>
                  <pre className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 max-h-64 overflow-auto whitespace-pre-wrap font-mono">
                    {resumeText || '(No resume text extracted)'}
                  </pre>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">
                    Job Description ({jobDescription.length} chars)
                  </h3>
                  <pre className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 max-h-64 overflow-auto whitespace-pre-wrap font-mono">
                    {jobDescription || '(No job description)'}
                  </pre>
                </div>
                {draft?.draftId && (
                  <div className="text-xs text-slate-400">
                    <p>Draft ID: {draft.draftId}</p>
                    <p>Status: {draft.status}</p>
                    <p>Initial Score: {draft.initialScore}</p>
                    <p>Current Score: {draft.currentAtsScore}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white p-3 flex-shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAiRequest(); }}
                placeholder="Ask AI to optimize your resume (e.g., 'Add missing keywords naturally')"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
                disabled={aiLoading}
              />
              <button
                onClick={handleAiRequest}
                disabled={aiLoading || !aiInput.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 cursor-pointer"
              >
                {aiLoading ? 'Generating...' : 'AI Optimize'}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              AI uses your real resume text + job description. No hallucination.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function applySimpleOptimization(latex: string, missingKws: string[], prompt: string): string {
  if (!latex || !missingKws.length) return latex;

  const lowerPrompt = prompt.toLowerCase();
  const kwsToAdd = missingKws.slice(0, 5);

  if (lowerPrompt.includes('keyword') || lowerPrompt.includes('optim') || lowerPrompt.includes('improve') || lowerPrompt.includes('ats')) {
    const skillsMatch = latex.match(/\\section\{Skills\}[\s\S]*?\\item\s+(.*?)(?:\n|$)/);
    if (skillsMatch) {
      const existingSkills = skillsMatch[1];
      const newSkills = kwsToAdd.filter(kw => !existingSkills.toLowerCase().includes(kw.toLowerCase()));
      if (newSkills.length > 0) {
        return latex.replace(
          skillsMatch[0],
          skillsMatch[0].replace(/\\item\s+(.*?)(?:\n|$)/,
            `\\item ${existingSkills}, ${newSkills.join(', ')}\n`
          )
        );
      }
    }
  }

  return latex;
}

export default function EditorPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center text-slate-500">
        Loading editor...
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
}
