import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const API_URL = process.env.LLM_API_URL || "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.LLM_MODEL || "minimax/minimax-m2.5:free";

const GARBAGE_KW = new Set([
  "development", "ai-generated", "modern", "optimization", "improve",
  "technologies", "advanced", "related", "architecture", "design",
  "looking", "join", "company", "opportunity", "position", "apply",
  "prefer", "required", "preferred", "qualifications", "bonus",
  "excellent", "communication", "understanding", "knowledge",
  "familiarity", "proficiency", "proficient", "expertise", "hands-on",
  "environment", "agile", "practices", "methodologies", "approach",
  "solutions", "deliver", "delivering", "building", "creating",
  "maintaining", "ensure", "across", "multiple", "both", "either",
  "based", "focus", "focused", "maintainability", "end",
  "scalable", "production", "integration", "implementation",
  "management", "quality", "best", "standards", "process",
  "processes", "platform", "platforms", "frameworks", "libraries",
  "develop", "developing", "provide", "providing", "support",
  "supporting", "collaborate", "collaborating", "contribute",
  "drive", "driving", "lead", "leading", "ensuring",
  "help", "want", "like", "would", "could", "may", "might",
  "since", "still", "while", "then", "there", "here", "much",
  "many", "those", "these", "being", "having", "doing", "going",
  "make", "take", "own", "per", "via", "through", "along",
  "whether", "high", "low", "great", "key", "core",
  "deep", "wide", "full", "true", "real", "able", "available",
  "minimum", "maximum", "ideal", "clear", "simple", "complex",
  "enhance", "deliverables", "domain", "evaluate", "assess",
  "scalability", "software", "models", "responsive", "code",
  "research", "analysis", "analytical", "strong", "written",
  "verbal", "interpersonal", "detail-oriented", "self-motivated",
  "proactive", "passionate", "driven", "enthusiastic", "curious",
  "innovative", "diverse", "top", "exceptional", "interactive",
  "applications", "bairesdev", "grade", "tier",
]);

function filterKeywords(keywords: string[]): string[] {
  return keywords.filter((kw) => {
    const lower = kw.toLowerCase().trim();
    if (GARBAGE_KW.has(lower)) return false;
    if (lower.length < 3) return false;
    return true;
  });
}

function extractNameFromLatex(latex: string): string {
  const match = latex.match(/\\bfseries\s+([^\\}]+?)\\?\[?\d/);
  if (match) return match[1].trim();
  const match2 = latex.match(/\\bfseries\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
  if (match2) return match2[1].trim();
  const match3 = latex.match(/\\LARGE\\bfseries\s+([^\\}]+?)\}/);
  if (match3) return match3[1].trim();
  return "";
}

function extractContactFromLatex(latex: string): { email: string; phone: string; linkedin: string } {
  const emailMatch = latex.match(/[\w.+-]+@[\w.-]+\.\w+/);
  const phoneMatch = latex.match(/\+?\d[\d\s\-()]{6,}/);
  const linkedinMatch = latex.match(/linkedin\.com\/in\/[\w-]+/i);
  return {
    email: emailMatch ? emailMatch[0] : "",
    phone: phoneMatch ? phoneMatch[0].trim() : "",
    linkedin: linkedinMatch ? linkedinMatch[0] : "",
  };
}

const SECTION_REGEX: [RegExp, string][] = [
  [/^(professional\s+summary|summary|objective|about\s+me|profile|career\s+summary)/i, "Professional Summary"],
  [/^(work\s+experience|professional\s+experience|experience|employment|work\s+history)/i, "Experience"],
  [/^(technical\s+skills|skills|technologies|competencies|core\s+competencies)/i, "Skills"],
  [/^(projects?|personal\s+projects?|key\s+projects?)/i, "Projects"],
  [/^(education|academic\s+background|academics)/i, "Education"],
  [/^(achievements?|awards?|honors?|accomplishments?|certifications?)/i, "Achievements"],
];

function isSectionHeading(trimmed: string): string | null {
  if (trimmed.length > 60) return null;
  for (const [regex, heading] of SECTION_REGEX) {
    if (regex.test(trimmed)) return heading;
  }
  return null;
}

const SYSTEM_PROMPT = `You are an expert resume writer who generates LaTeX resumes. Follow these rules STRICTLY:

CRITICAL RULES:
1. Keep the person's EXACT name, email, phone, LinkedIn, GitHub URLs unchanged.
2. NEVER use placeholders like "Your Name" or "your.email@example.com".
3. Keep ALL sections from the original resume: Summary, Experience, Skills, Projects, Education, Achievements.
4. Do NOT remove or merge sections. Experience MUST be a separate section from Projects.
5. Only rephrase bullet points - do NOT change company names, dates, metrics, or technologies.
6. Add missing keywords NATURALLY within bullet points where truthful - do NOT list them in Skills.
7. Generate ONLY valid LaTeX code using article class with standard packages.
8. No markdown fences, no explanations.
9. Use \\textbf{} for job titles and company names within Experience section items.
10. Keep the resume to 1 page maximum.
11. IMPORTANT: Generate the COMPLETE document. Do NOT truncate. The \\end{document} must be present.
12. Make sure ALL braces {} are properly matched and closed.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resumeText, currentLatex, jobDescription, jobTitle, company, matchedKeywords, missingKeywords, suggestions, source } = body;

    const cleanMissing = filterKeywords(missingKeywords || []);
    const cleanMatched = filterKeywords(matchedKeywords || []);

    const latexName = currentLatex ? extractNameFromLatex(currentLatex) : "";
    const latexContact = currentLatex ? extractContactFromLatex(currentLatex) : { email: "", phone: "", linkedin: "" };

    const contactInfo = [];
    if (latexContact.phone) contactInfo.push(`Phone: ${latexContact.phone}`);
    if (latexContact.email) contactInfo.push(`Email: ${latexContact.email}`);
    if (latexContact.linkedin) contactInfo.push(`LinkedIn: ${latexContact.linkedin}`);

    const userPrompt = `${latexName ? `IMPORTANT - Use this EXACT name: "${latexName}"` : ""}
${contactInfo.length > 0 ? `IMPORTANT - Use these EXACT contacts: ${contactInfo.join(" | ")}` : ""}

Optimize this resume for the job:

**Job Title:** ${jobTitle || "Software Developer"}
**Company:** ${company || "Unknown"}

**Job Description:**
${jobDescription || ""}

**Current Resume Text (preserve ALL real data):**
${resumeText || "No resume text provided"}

${currentLatex ? `**Current LaTeX Source (improve, keep all data):**
${currentLatex}` : ""}

**ATS Analysis:**
- Matched: ${cleanMatched.join(", ")}
- Missing (weave into bullets naturally): ${cleanMissing.join(", ")}

Generate the COMPLETE optimized LaTeX resume. Ensure \\end{document} is present.`;

    let latexSource = "";
    let usedModel = "";

    // Priority 1: Gemini (free, unlimited, fast) with retry
    if (GEMINI_KEY) {
      const geminiModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash-preview-05-20"];
      for (const gemModel of geminiModels) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            if (attempt === 0) {
              console.log(`[/api/optimize] Trying Gemini ${gemModel}`);
            } else {
              console.log(`[/api/optimize] Retrying Gemini ${gemModel} after delay`);
              await new Promise((r) => setTimeout(r, 5000));
            }
            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${gemModel}:generateContent?key=${GEMINI_KEY}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${userPrompt}` }] }],
                  generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
                }),
              }
            );
            if (geminiRes.status === 429 && attempt === 0) {
              const errBody = await geminiRes.text().catch(() => "");
              const retryMatch = errBody.match(/retryDelay.*?(\d+)s/);
              const waitSec = retryMatch ? Math.min(parseInt(retryMatch[1]), 40) : 30;
              console.log(`[/api/optimize] Gemini ${gemModel} rate-limited, waiting ${waitSec}s`);
              await new Promise((r) => setTimeout(r, waitSec * 1000));
              continue;
            }
            if (geminiRes.ok) {
              const gemData = await geminiRes.json();
              let gemText = gemData.candidates?.[0]?.content?.parts?.[0]?.text || "";
              if (gemText.includes("```latex")) gemText = gemText.replace(/```latex\n?/g, "").replace(/```/g, "");
              if (gemText.includes("```")) gemText = gemText.replace(/```\n?/g, "");
              gemText = gemText.trim();
              if (gemText.startsWith("\\documentclass")) {
                latexSource = gemText;
                usedModel = gemModel;
                console.log(`[/api/optimize] Gemini ${gemModel} success, length:`, latexSource.length);
                break;
              }
              console.error(`[/api/optimize] Gemini ${gemModel} non-LaTeX:`, gemText.slice(0, 80));
            } else {
              const errText = await geminiRes.text().catch(() => "");
              console.error(`[/api/optimize] Gemini ${gemModel} error:`, geminiRes.status, errText.slice(0, 150));
            }
          } catch (gemErr) {
            console.error(`[/api/optimize] Gemini ${gemModel} exception:`, gemErr);
          }
          break;
        }
        if (latexSource) break;
      }
    }

    // Priority 2: OpenRouter models
    if (!latexSource && OPENROUTER_KEY) {
      const modelsToTry = [
        MODEL,
        "minimax/minimax-m2.5:free",
        "qwen/qwen3-next-80b-a3b-instruct:free",
        "deepseek/deepseek-v4-flash:free",
        "google/gemma-4-26b-a4b-it:free",
        "qwen/qwen3-coder:free",
      ].filter((m, i, arr) => arr.indexOf(m) === i);

      let lastError = "";

      for (const model of modelsToTry) {
        try {
          const response = await fetch(API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${OPENROUTER_KEY}`,
              "HTTP-Referer": "http://localhost:3000",
              "X-Title": "ResumeForge",
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userPrompt },
              ],
              temperature: 0.3,
              max_tokens: 6000,
            }),
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => "");
            console.error(`LLM API error for ${model}:`, response.status, errText.slice(0, 150));
            lastError = `LLM ${model}: ${response.status}`;
            continue;
          }

          const data = await response.json();
          let llmOutput = data.choices?.[0]?.message?.content || "";
          if (llmOutput.includes("```latex")) llmOutput = llmOutput.replace(/```latex\n?/g, "").replace(/```/g, "");
          if (llmOutput.includes("```")) llmOutput = llmOutput.replace(/```\n?/g, "");
          llmOutput = llmOutput.trim();

          if (llmOutput.startsWith("\\documentclass")) {
            latexSource = llmOutput;
            usedModel = model;
            break;
          }
          lastError = `${model}: invalid LaTeX`;
        } catch (err) {
          lastError = (err as Error).message;
        }
      }

      if (!latexSource) {
        console.error("[/api/optimize] All models failed, using fallback");
        latexSource = generateFallbackLatex(resumeText, currentLatex, jobTitle || "Resume", company || "", cleanMissing);
        return NextResponse.json({ latexSource, optimized: false, error: "All LLM models failed" });
      }
    }

    if (!latexSource) {
      latexSource = generateFallbackLatex(resumeText, currentLatex, jobTitle || "Resume", company || "", cleanMissing);
      return NextResponse.json({ latexSource, optimized: false, error: "No LLM available" });
    }

    // Validate: ensure \end{document} exists
    if (!latexSource.includes("\\end{document}")) {
      latexSource += "\n\\end{document}";
    }

    return NextResponse.json({ latexSource, optimized: true, model: usedModel });
  } catch (err: any) {
    console.error("Optimize error:", err);
    return NextResponse.json({
      error: err.message,
      latexSource: generateFallbackLatex("", "", "Resume", "", []),
      optimized: false,
    }, { status: 500 });
  }
}

function generateFallbackLatex(
  resumeText: string,
  currentLatex: string,
  jobTitle: string,
  company: string,
  missingKeywords: string[]
): string {
  const resumeLines = (resumeText || "").split("\n").filter((l) => l.trim());
  let name = "";
  let email = "";
  let phone = "";
  let linkedin = "";
  let github = "";
  let location = "";
  let headerDone = false;

  if (currentLatex) {
    name = extractNameFromLatex(currentLatex);
    const contact = extractContactFromLatex(currentLatex);
    email = contact.email;
    phone = contact.phone;
    linkedin = contact.linkedin;
  }

  interface Section {
    heading: string;
    lines: string[];
  }
  const sections: Section[] = [];
  let currentSection: Section | null = null;

  for (const line of resumeLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (!email && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
      email = trimmed;
      continue;
    }
    if (!email && /[\w.+-]+@[\w.-]+\.\w+/.test(trimmed) && !headerDone) {
      const m = trimmed.match(/([\w.+-]+@[\w.-]+\.\w+)/);
      if (m) email = m[1];
    }
    if (!phone && /(\+?\d[\d\s\-()]{7,})/.test(trimmed) && !headerDone) {
      const m = trimmed.match(/(\+?\d[\d\s\-()]{7,})/);
      if (m && m[1].replace(/\D/g, "").length >= 8) { phone = m[1].trim(); continue; }
    }
    if (!linkedin && /(linkedin\.com\/in\/[\w-]+)/i.test(trimmed)) {
      const m = trimmed.match(/(linkedin\.com\/in\/[\w-]+)/i);
      if (m) linkedin = m[1];
    }
    if (!github && /(github\.com\/[\w-]+)/i.test(trimmed)) {
      const m = trimmed.match(/(github\.com\/[\w-]+)/i);
      if (m) github = m[1];
    }

    const sectionHeading = isSectionHeading(trimmed);
    if (sectionHeading) {
      currentSection = { heading: sectionHeading, lines: [] };
      sections.push(currentSection);
      headerDone = true;
      continue;
    }

    if (!name && !headerDone && trimmed.length > 2 && trimmed.length < 60 &&
        /^[A-Z]/.test(trimmed) &&
        !/[@|:;,]/.test(trimmed) &&
        !/^\d/.test(trimmed) &&
        !/(http|www|\.com|\.in|\.org)/.test(trimmed) &&
        !/^\+?\d/.test(trimmed)) {
      name = trimmed;
      continue;
    }

    if (!headerDone && /^(jaipur|delhi|mumbai|bangalore|hyderabad|chennai|kolkata|pune|india|usa|uk|canada)/i.test(trimmed) && trimmed.length < 80) {
      location = trimmed;
      continue;
    }

    if (!headerDone) {
      if (/^—/.test(trimmed) || /^[•\-\*]\s/.test(trimmed) || /remote/i.test(trimmed)) continue;
      if (trimmed.includes("LinkedIn") || trimmed.includes("GitHub") || trimmed.includes("GitLab")) continue;
    }

    if (currentSection) {
      if (trimmed === "1" || trimmed === "•" || /^\d+$/.test(trimmed)) continue;
      currentSection.lines.push(trimmed);
    }
  }

  if (!name && currentLatex) name = extractNameFromLatex(currentLatex);

  const escLatex = (s: string): string =>
    String(s)
      .replace(/\\/g, "\\textbackslash{}")
      .replace(/[&%$#_{}]/g, (c: string) => `\\${c}`)
      .replace(/~/g, "\\textasciitilde{}")
      .replace(/\^/g, "\\textasciicircum{}");

  const skillsSection = sections.find((s) => s.heading === "Skills");
  const rawSkills: string[] = [];
  if (skillsSection) {
    skillsSection.lines.forEach((l) => {
      l.split(/[,;&|]/).forEach((s) => {
        const t = s.trim();
        if (t && !GARBAGE_KW.has(t.toLowerCase()) && t.length > 1 && !/^\d+$/.test(t)) {
          rawSkills.push(t);
        }
      });
    });
  }
  const cleanMissingForSkills = missingKeywords.filter((kw) => {
    const lower = kw.toLowerCase();
    if (GARBAGE_KW.has(lower)) return false;
    if (rawSkills.some((s) => s.toLowerCase().includes(lower))) return false;
    return true;
  });
  const allSkills = [...new Set([...rawSkills, ...cleanMissingForSkills])].slice(0, 25);

  const contactParts = [location, phone, email, linkedin, github].filter(Boolean);

  let latex = `\\documentclass[11pt,a4paper]{article}
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
\\titlespacing{\\section}{0pt}{8pt}{4pt}

\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{2pt}

\\begin{document}

\\begin{center}
  {\\LARGE\\bfseries ${escLatex(name || "Your Name")}}\\\\[4pt]
  ${contactParts.length > 0 ? contactParts.map((s) => `{\\small ${escLatex(s)}}`).join(" $\\cdot$ ") : ""}
\\end{center}
`;

  const summarySection = sections.find((s) => s.heading === "Professional Summary");
  if (summarySection && summarySection.lines.length > 0) {
    latex += `\\section{Professional Summary}\n${summarySection.lines.map((l) => escLatex(l)).join(" ")}\n\n`;
  }

  const expSection = sections.find((s) => s.heading === "Experience");
  if (expSection && expSection.lines.length > 0) {
    latex += `\\section{Experience}\n\\begin{itemize}[leftmargin=*,itemsep=2pt]\n`;
    for (const line of expSection.lines) {
      latex += `  \\item ${escLatex(line)}\n`;
    }
    latex += `\\end{itemize}\n\n`;
  }

  if (allSkills.length > 0) {
    latex += `\\section{Skills}\n\\begin{itemize}[leftmargin=*,itemsep=2pt]\n  \\item ${allSkills.map((s) => escLatex(s)).join(", ")}\n\\end{itemize}\n\n`;
  }

  const projSection = sections.find((s) => s.heading === "Projects");
  if (projSection && projSection.lines.length > 0) {
    latex += `\\section{Projects}\n\\begin{itemize}[leftmargin=*,itemsep=2pt]\n`;
    for (const line of projSection.lines) {
      latex += `  \\item ${escLatex(line)}\n`;
    }
    latex += `\\end{itemize}\n\n`;
  }

  const eduSection = sections.find((s) => s.heading === "Education");
  if (eduSection && eduSection.lines.length > 0) {
    latex += `\\section{Education}\n\\begin{itemize}[leftmargin=*,itemsep=2pt]\n`;
    for (const line of eduSection.lines) {
      if (/^\d+(\.\d+)?$/.test(line.trim())) continue;
      latex += `  \\item ${escLatex(line)}\n`;
    }
    latex += `\\end{itemize}\n\n`;
  }

  const achSection = sections.find((s) => s.heading === "Achievements");
  if (achSection && achSection.lines.length > 0) {
    latex += `\\section{Achievements}\n\\begin{itemize}[leftmargin=*,itemsep=2pt]\n`;
    for (const line of achSection.lines) {
      latex += `  \\item ${escLatex(line)}\n`;
    }
    latex += `\\end{itemize}\n\n`;
  }

  latex += `\\end{document}`;
  return latex;
}
