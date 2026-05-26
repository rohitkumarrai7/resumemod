import { NextRequest, NextResponse } from "next/server";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

const SYSTEM_PROMPT = `You are an expert interview coach. Generate interview preparation questions and talking points.

Rules:
1. Generate 8-10 interview questions specific to the role and company.
2. Mix behavioral, technical, and situational questions.
3. For each question, provide a brief "Approach" hint using the candidate's actual resume experience.
4. Categorize questions as: Technical, Behavioral, Situational, or Company-Specific.
5. Output valid JSON array with objects: { "category", "question", "approach", "difficulty" }
6. difficulty is one of: "easy", "medium", "hard"
7. Do NOT fabricate resume details. Only reference what is actually in the resume text.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resumeText, jobDescription, jobTitle, company } = body;

    if (!jobDescription) {
      return NextResponse.json({ error: "Job description is required" }, { status: 400 });
    }

    const userPrompt = `Generate interview prep for:

**Job Title:** ${jobTitle || "the position"}
**Company:** ${company || "the company"}

**Job Description:**
${jobDescription.slice(0, 3000)}

**Candidate Resume:**
${(resumeText || "Not provided").slice(0, 3000)}

Generate the JSON array of interview questions now.`;

    if (!GEMINI_KEY) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 4096 },
        }),
      }
    );

    if (!geminiRes.ok) {
      return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
    }

    const gemData = await geminiRes.json();
    let content = gemData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract JSON from markdown fences if present
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) content = jsonMatch[1];

    try {
      const questions = JSON.parse(content.trim());
      return NextResponse.json({ questions, provider: "gemini-2.0-flash" });
    } catch {
      return NextResponse.json({ questions: [], raw: content, provider: "gemini-2.0-flash" });
    }
  } catch (error: any) {
    console.error("[interview-prep] Error:", error);
    return NextResponse.json({ error: error.message || "Generation failed" }, { status: 500 });
  }
}
