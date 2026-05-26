import type { ResumeBullet, ResumeSection } from "./types";

export interface StructuredResume {
  contact: {
    name: string;
    email: string;
    phone: string;
    linkedin: string;
  };
  sections: ResumeSection[];
}

function slugId(prefix: string, index: number) {
  return `${prefix}-${index}`;
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
      /^(summary|objective|about|profile|professional summary|experience|employment|work history|work experience|professional experience|education|academic|skills|technologies|technical skills|competencies|projects?|certifications?|awards?|achievements?)$/i
    );
    if (sectionMatch && line.length < 50) {
      const heading = sectionMatch[1].charAt(0).toUpperCase() + sectionMatch[1].slice(1);
      const typeMap: Record<string, ResumeSection["type"]> = {
        summary: "summary",
        objective: "summary",
        about: "summary",
        profile: "summary",
        experience: "experience",
        employment: "experience",
        education: "education",
        academic: "education",
        skills: "skills",
        technologies: "skills",
        projects: "projects",
        project: "projects",
        certifications: "certifications",
        certification: "certifications",
        awards: "achievements",
        achievements: "achievements",
        achievement: "achievements",
      };
      const key = sectionMatch[1].toLowerCase().replace(/\s+/g, " ");
      const type = typeMap[key] || "custom";
      current = {
        id: slugId("sec", order++),
        type,
        heading,
        items: [],
        order,
      };
      sections.push(current);
      continue;
    }

    if (!name && !current && line.length < 60 && !line.includes("@") && !/^\d/.test(line)) {
      name = line;
      continue;
    }

    if (!current) {
      current = {
        id: slugId("sec", order++),
        type: "summary",
        heading: "Summary",
        items: [],
        order,
      };
      sections.push(current);
    }

    current.items.push({
      id: slugId("bullet", current.items.length),
      text: line.replace(/^[-•*]\s*/, ""),
    });
  }

  if (!name && lines[0]) name = lines[0].slice(0, 60);

  return {
    contact: { name, email, phone, linkedin },
    sections,
  };
}

export function structuredResumeToText(resume: StructuredResume): string {
  const parts: string[] = [];
  if (resume.contact.name) parts.push(resume.contact.name);
  if (resume.contact.email) parts.push(resume.contact.email);
  if (resume.contact.phone) parts.push(resume.contact.phone);
  if (resume.contact.linkedin) parts.push(resume.contact.linkedin);
  parts.push("");

  for (const section of resume.sections) {
    parts.push(section.heading.toUpperCase());
    for (const item of section.items) {
      parts.push(`- ${item.text}`);
    }
    parts.push("");
  }
  return parts.join("\n").trim();
}

export interface TailorSuggestion {
  id: string;
  sectionId: string;
  bulletId?: string;
  type: "rewrite" | "add" | "remove";
  originalText: string;
  suggestedText: string;
  reason: string;
  keywords: string[];
  applied: boolean;
}

export function buildSuggestions(
  resume: StructuredResume,
  missingKeywords: string[],
  rawSuggestions: string[]
): TailorSuggestion[] {
  const suggestions: TailorSuggestion[] = [];

  missingKeywords.slice(0, 8).forEach((kw, i) => {
    suggestions.push({
      id: `kw-${i}`,
      sectionId: resume.sections.find((s) => s.type === "skills")?.id || "skills",
      type: "add",
      originalText: "",
      suggestedText: `Add "${kw}" to your skills where you have relevant experience.`,
      reason: "Missing keyword from job description",
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
      reason: "AI optimization tip",
      keywords: [],
      applied: false,
    });
  });

  const expSection = resume.sections.find((s) => s.type === "experience");
  if (expSection && missingKeywords.length > 0) {
    const bullet = expSection.items[0];
    if (bullet) {
      const kw = missingKeywords[0];
      suggestions.push({
        id: "rewrite-0",
        sectionId: expSection.id,
        bulletId: bullet.id,
        type: "rewrite",
        originalText: bullet.text,
        suggestedText: `${bullet.text} (emphasizing ${kw} where applicable)`.slice(0, 280),
        reason: `Incorporate "${kw}" into a recent role bullet`,
        keywords: [kw],
        applied: false,
      });
    }
  }

  return suggestions;
}

export function applySuggestionToResume(
  resume: StructuredResume,
  suggestion: TailorSuggestion
): StructuredResume {
  const next = JSON.parse(JSON.stringify(resume)) as StructuredResume;

  if (suggestion.type === "add" && suggestion.keywords.length > 0) {
    let skills = next.sections.find((s) => s.type === "skills");
    if (!skills) {
      skills = {
        id: "skills-auto",
        type: "skills",
        heading: "Skills",
        items: [],
        order: next.sections.length,
      };
      next.sections.push(skills);
    }
    const kw = suggestion.keywords[0];
    const existing = skills.items.map((i) => i.text.toLowerCase()).join(" ");
    if (!existing.includes(kw.toLowerCase())) {
      skills.items.push({ id: `skill-${Date.now()}`, text: kw });
    }
    return next;
  }

  if (suggestion.bulletId && suggestion.type === "rewrite") {
    for (const section of next.sections) {
      const bullet = section.items.find((b) => b.id === suggestion.bulletId);
      if (bullet) {
        bullet.text = suggestion.suggestedText;
        break;
      }
    }
  }

  return next;
}
