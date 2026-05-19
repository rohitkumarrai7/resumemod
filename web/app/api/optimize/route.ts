import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.OPENROUTER_API_KEY || "";
const API_URL = process.env.LLM_API_URL || "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.LLM_MODEL || "qwen/qwen3-30b-a3b-instruct:free";

const VALID_FALLBACK_MODELS = [
  "qwen/qwen3-30b-a3b-instruct:free",
  "qwen/qwen2.5-72b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-r1:free"
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resumeText, currentLatex, jobDescription, jobTitle, company, matchedKeywords, missingKeywords, suggestions, source } = body;

    if (!API_KEY || API_KEY === "your_openrouter_api_key_here") {
      return NextResponse.json({
        error: "LLM_API_KEY not configured. Add OPENROUTER_API_KEY to web/.env.local",
        latexSource: generateFallbackLatex(resumeText, jobTitle, company, missingKeywords || []),
        optimized: false,
      });
    }

    const systemPrompt = `You are an expert resume writer and LaTeX expert. Your job is to take a user's resume and optimize it for a specific job posting.

Rules:
1. Generate a complete, compilable LaTeX document using standard packages (article class, geometry, enumitem, titlesec, xcolor, hyperref)
2. Keep the person's real information (name, contact, education) unchanged
3. Rewrite experience bullets to match the job description keywords naturally
4. Add missing keywords where truthful and relevant
5. Use strong action verbs (Led, Built, Designed, Implemented, Optimized, Delivered)
6. Quantify achievements wherever possible
7. Keep it ATS-friendly: single column, standard section headings, no tables/graphics
8. Use clean formatting with proper LaTeX structure
9. Return ONLY the LaTeX code, no markdown fences, no explanations`;

    const userPrompt = `Optimize this resume for the following job:

**Job Title:** ${jobTitle || "Software Developer"}
**Company:** ${company || "Unknown"}
**Platform:** ${source || "Unknown"}

**Job Description:**
${jobDescription || ""}

**Current Resume Text:**
${resumeText || "No resume text provided"}

${currentLatex ? `**Current LaTeX Source (improve upon this):**
${currentLatex}` : ""}

**ATS Analysis:**
- Matched keywords: ${(matchedKeywords || []).join(", ")}
- Missing keywords: ${(missingKeywords || []).join(", ")}
- Suggestions: ${(suggestions || []).join("; ")}

Generate the complete optimized LaTeX resume document.`;

    const modelsToTry = [MODEL, ...VALID_FALLBACK_MODELS.filter(m => m !== MODEL)];
    let lastError = null;
    let latexSource = "";

    for (const model of modelsToTry) {
      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_KEY}`,
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "ResumeForge",
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.4,
            max_tokens: 4000,
          }),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          console.error(`LLM API error for model ${model}:`, response.status, errText);
          lastError = `LLM API error: ${response.status}`;
          continue;
        }

        const data = await response.json();
        latexSource = data.choices?.[0]?.message?.content || "";

        if (latexSource.includes("```latex")) {
          latexSource = latexSource.replace(/```latex\n?/g, "").replace(/```/g, "");
        }
        if (latexSource.includes("```")) {
          latexSource = latexSource.replace(/```\n?/g, "");
        }
        latexSource = latexSource.trim();

        if (latexSource.startsWith("\\documentclass")) {
          break;
        }
        lastError = "Model returned invalid LaTeX";
      } catch (err) {
        console.error(`Error with model ${model}:`, err);
        lastError = (err as Error).message;
      }
    }

    if (!latexSource || !latexSource.startsWith("\\documentclass")) {
      console.error("All LLM models failed, using fallback");
      latexSource = generateFallbackLatex(resumeText || "No resume text provided", jobTitle || "Software Developer", company || "Unknown", missingKeywords || []);
      return NextResponse.json({ latexSource, optimized: false, error: lastError || "All models failed" });
    }

    return NextResponse.json({ latexSource, optimized: true, model: MODEL });
  } catch (err: any) {
    console.error("Optimize error:", err);
    return NextResponse.json({
      error: err.message,
      latexSource: generateFallbackLatex("", "Resume", "", []),
      optimized: false,
    }, { status: 500 });
  }
}

function generateFallbackLatex(
  resumeText: string,
  jobTitle: string,
  company: string,
  missingKeywords: string[]
): string {
  const lines = (resumeText || "").split("\n").filter((l) => l.trim());
  let name = "Your Name";
  for (const line of lines) {
    if (line.trim().length > 2 && line.trim().length < 60 && /^[A-Z]/.test(line.trim())) {
      name = line.trim();
      break;
    }
  }

  return `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[margin=0.75in]{geometry}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{xcolor}
\\usepackage{hyperref}

\\definecolor{heading}{HTML}{1E3A5F}
\\titleformat{\\section}{\\large\\bfseries\\color{heading}}{}{0em}{}[\\titlerule]
\\pagestyle{empty}
\\setlength{\\parindent}{0pt}

\\begin{document}

\\begin{center}
  {\\LARGE\\bfseries ${name}}\\\\[4pt]
  {\\small your.email@example.com}
\\end{center}

\\section{Professional Summary}
Results-driven ${jobTitle || "professional"} with a proven track record of delivering high-quality solutions. Eager to contribute to ${company || "a dynamic team"}.

\\section{Skills}
${missingKeywords.length > 0 ? missingKeywords.slice(0, 12).join(", ") : "Add your skills here"}

\\section{Experience}
\\begin{itemize}[leftmargin=*]
  \\item \\textbf{Job Title} \\hfill Date Range \\\\
        Company - Describe achievements with quantifiable results.
  \\item \\textbf{Job Title} \\hfill Date Range \\\\
        Company - Led development of features used by X users.
\\end{itemize}

\\section{Education}
\\begin{itemize}[leftmargin=*]
  \\item \\textbf{Degree} \\hfill Year \\\\
        University Name
\\end{itemize}

\\end{document}`;
}
