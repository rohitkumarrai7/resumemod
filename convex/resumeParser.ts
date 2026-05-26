interface ResumeBullet {
  id: string;
  text: string;
}

interface ResumeSection {
  id: string;
  type: string;
  heading: string;
  items: ResumeBullet[];
  order: number;
}

export interface StructuredResume {
  contact: { name: string; email: string; phone: string; linkedin: string };
  sections: ResumeSection[];
}

export function parseResumeText(text: string): StructuredResume {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let name = "";
  let email = "";
  let phone = "";
  let linkedin = "";
  const sections: ResumeSection[] = [];
  let current: ResumeSection | null = null;
  let order = 0;

  for (const line of lines) {
    if (/^[\w\s+.-]+@[\w.-]+\.\w+$/.test(line) && !email) {
      email = line;
      continue;
    }
    if (/^[\+]?[\d\s\-().]{7,}$/.test(line) && !phone) {
      phone = line;
      continue;
    }
    if (/linkedin\.com/i.test(line) && !linkedin) {
      linkedin = line;
      continue;
    }

    const sectionMatch = line.match(
      /^(summary|objective|experience|employment|education|skills|technologies|projects?|certifications?)$/i
    );
    if (sectionMatch && line.length < 50) {
      const heading = sectionMatch[1].charAt(0).toUpperCase() + sectionMatch[1].slice(1);
      const typeMap: Record<string, ResumeSection["type"]> = {
        summary: "summary",
        objective: "summary",
        experience: "experience",
        employment: "experience",
        education: "education",
        skills: "skills",
        technologies: "skills",
        projects: "projects",
        project: "projects",
        certifications: "certifications",
        certification: "certifications",
      };
      const key = sectionMatch[1].toLowerCase();
      current = {
        id: `sec-${order++}`,
        type: typeMap[key] || "custom",
        heading,
        items: [],
        order,
      };
      sections.push(current);
      continue;
    }

    if (!name && !current && line.length < 60 && !line.includes("@")) {
      name = line;
      continue;
    }

    if (!current) {
      current = { id: `sec-${order++}`, type: "summary", heading: "Summary", items: [], order };
      sections.push(current);
    }

    current.items.push({ id: `b-${current.items.length}`, text: line.replace(/^[-•*]\s*/, "") });
  }

  if (!name && lines[0]) name = lines[0].slice(0, 60);
  return { contact: { name, email, phone, linkedin }, sections };
}

export function buildSuggestions(
  resume: StructuredResume,
  missingKeywords: string[],
  rawSuggestions: unknown[]
): Array<{
  id: string;
  sectionId: string;
  bulletId?: string;
  type: string;
  originalText: string;
  suggestedText: string;
  reason: string;
  keywords: string[];
  applied: boolean;
}> {
  const suggestions: Array<{
    id: string;
    sectionId: string;
    bulletId?: string;
    type: string;
    originalText: string;
    suggestedText: string;
    reason: string;
    keywords: string[];
    applied: boolean;
  }> = [];

  missingKeywords.slice(0, 8).forEach((kw, i) => {
    suggestions.push({
      id: `kw-${i}`,
      sectionId: resume.sections.find((s) => s.type === "skills")?.id || "skills",
      type: "add",
      originalText: "",
      suggestedText: `Add "${kw}" to skills where truthful.`,
      reason: "Missing JD keyword",
      keywords: [kw],
      applied: false,
    });
  });

  rawSuggestions.slice(0, 6).forEach((msg, i) => {
    suggestions.push({
      id: `tip-${i}`,
      sectionId: resume.sections[0]?.id || "general",
      type: "rewrite",
      originalText: "",
      suggestedText: typeof msg === "string" ? msg : String(msg),
      reason: "Optimization tip",
      keywords: [],
      applied: false,
    });
  });

  return suggestions;
}
