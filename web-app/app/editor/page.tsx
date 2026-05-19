'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Editor from '@monaco-editor/react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface DraftContext {
  draftId: string;
  status: string;
  context: {
    resume: {
      filename: string;
      extractedText: string;
    };
    job: {
      title: string;
      company: string;
      description: string;
    };
    localAnalysis?: {
      score: number;
      missingKeywords: string[];
    };
  };
  latexSource?: string;
  currentAtsScore?: number;
}

function EditorContent() {
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draft');

  const [draft, setDraft] = useState<DraftContext | null>(null);
  const [latexSource, setLatexSource] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [atsScore, setAtsScore] = useState<number | null>(null);
  const [missingKeywords, setMissingKeywords] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!draftId) {
      setError('No draft ID provided');
      return;
    }

    fetchDraft(draftId);
  }, [draftId]);

  const fetchDraft = async (id: string) => {
    try {
      const res = await fetch(`https://stoic-caiman-320.convex.site/v1/drafts/${id}`, {
        headers: {
          'Authorization': 'Bearer ' + (typeof window !== 'undefined' ? localStorage.getItem('token') : '')
        }
      });

      if (!res.ok) throw new Error('Failed to load draft');

      const data = await res.json();
      setDraft(data);
      setLatexSource(data.latexSource || '');
      setAtsScore(data.currentAtsScore || data.context?.localAnalysis?.score || 0);
      setMissingKeywords(data.context?.localAnalysis?.missingKeywords || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const compile = async () => {
    if (!draftId || !latexSource) return;

    setIsCompiling(true);
    try {
      const res = await fetch(`https://stoic-caiman-320.convex.site/v1/drafts/${draftId}/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (typeof window !== 'undefined' ? localStorage.getItem('token') : '')
        },
        body: JSON.stringify({ latexSource })
      });

      const data = await res.json();
      if (data.success) {
        setPdfUrl(data.pdfUrl);
        setAtsScore(data.atsScore);
        setMissingKeywords(data.missingKeywords);
      }
    } catch (err) {
      console.error('Compile failed:', err);
    } finally {
      setIsCompiling(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (latexSource && latexSource.length > 100) {
        compile();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [latexSource]);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!draft) return <div className="p-8">Loading draft...</div>;

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-slate-900 text-white p-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">ResumeForge Editor</h1>
          <p className="text-sm text-slate-400">
            {draft.context?.job?.title} @ {draft.context?.job?.company}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {atsScore !== null && (
            <div className={`px-3 py-1 rounded-full text-sm font-bold ${
              atsScore >= 75 ? 'bg-green-500' :
              atsScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
            }`}>
              ATS: {atsScore}/100
            </div>
          )}
          <button
            onClick={compile}
            disabled={isCompiling}
            className="px-4 py-2 bg-blue-600 rounded-lg font-medium disabled:opacity-50 cursor-pointer"
          >
            {isCompiling ? 'Compiling...' : 'Compile'}
          </button>
          <button className="px-4 py-2 bg-green-600 rounded-lg font-medium cursor-pointer">
            Download PDF
          </button>
        </div>
      </header>

      <div className="flex-1 flex">
        <div className="w-1/2 flex flex-col border-r border-slate-200">
          <div className="bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
            LaTeX Source
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
                fontSize: 14,
                wordWrap: 'on',
                automaticLayout: true
              }}
            />
          </div>
        </div>

        <div className="w-1/2 flex flex-col">
          <div className="flex-1 bg-slate-100 p-4 overflow-auto">
            {pdfUrl ? (
              <div className="bg-white shadow-lg mx-auto" style={{ width: 'fit-content' }}>
                <Document file={pdfUrl}>
                  <Page pageNumber={1} width={500} />
                </Document>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                {isCompiling ? 'Compiling PDF...' : 'Click Compile to generate PDF'}
              </div>
            )}
          </div>

          <div className="h-64 bg-white border-t border-slate-200 p-4 overflow-auto">
            <h3 className="font-bold text-sm mb-3">Job Analysis</h3>

            {missingKeywords && missingKeywords.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-red-600 font-medium mb-2">
                  Missing Keywords ({missingKeywords.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {missingKeywords.map((kw: string) => (
                    <span key={kw} className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-full">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="text-sm text-slate-600">
              <p className="mb-2"><strong>Job:</strong> {draft.context?.job?.title}</p>
              <p className="mb-2"><strong>Company:</strong> {draft.context?.job?.company}</p>
              <p className="mb-2"><strong>Source:</strong> {draft.context?.job?.description?.slice(0, 200)}...</p>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 mb-2">AI Assistant</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask AI to modify your resume..."
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
                <button className="px-3 py-2 bg-slate-800 text-white rounded-lg text-sm cursor-pointer">
                  Send
                </button>
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
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <EditorContent />
    </Suspense>
  );
}