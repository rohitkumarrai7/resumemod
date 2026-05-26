import { NextRequest, NextResponse } from "next/server";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

const SYSTEM_PROMPT = `You are an expert cover letter writer. Generate a compelling, professional cover letter.

Rules:
1. Keep it concise — 3-4 paragraphs maximum.
2. Reference specific job requirements and match them to the candidate's experience.
3. Use the candidate's actual achievements and metrics from their resume.
4. Never fabricate experience, companies, or qualifications.
5. Match the requested tone precisely.
6. Do not include placeholder brackets like [Company Name] — use the actual values.
7. Output ONLY the cover letter text, no subject lines or formatting instructions.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resumeText, jobDescription, jobTitle, company, tone } = body;

    if (!resumeText || !jobDescription) {
      return NextResponse.json(
        { error: "Resume text and job description are required" },
        { status: 400 }
      );
    }

    const toneGuide: Record<string, string> = {
      concise: "Write in a direct, no-fluff style. Every sentence should add value.",
      confident: "Write with bold confidence. Emphasize leadership and measurable impact.",
      technical: "Focus on technical expertise, tools, and engineering methodology.",
      warm: "Write in a personable, enthusiastic tone that shows cultural fit.",
    };

    const userPrompt = `Generate a cover letter for this position:

**Job Title:** ${jobTitle || "the position"}
**Company:** ${company || "the company"}
**Tone:** ${toneGuide[tone] || toneGuide.confident}

**Job Description:**
${jobDescription.slice(0, 3000)}

**Candidate Resume:**
${resumeText.slice(0, 4000)}

Write the cover letter now.`;

    if (!GEMINI_KEY) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 503 }
      );
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      console.error("[cover-letter] Gemini error:", geminiRes.status, errText.slice(0, 200));
      return NextResponse.json(
        { error: "AI generation failed" },
        { status: 502 }
      );
    }

    const gemData = await geminiRes.json();
    const content = gemData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return NextResponse.json({ content, provider: "gemini-2.0-flash" });
  } catch (error: any) {
    console.error("[cover-letter] Error:", error);
    return NextResponse.json(
      { error: error.message || "Generation failed" },
      { status: 500 }
    );
  }
}
