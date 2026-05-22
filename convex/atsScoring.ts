const STOP_WORDS = new Set([
  "and", "the", "for", "with", "you", "are", "our", "will", "have", "this",
  "that", "from", "your", "role", "team", "work", "experience", "skills",
  "good", "strong", "ability", "responsibilities", "requirements", "about",
  "into", "who", "what", "when", "where", "why", "they", "their", "job",
  "candidate", "must", "should", "can", "any", "all", "not", "but", "also",
  "well", "plus", "etc", "including", "using", "new", "has", "had", "been",
  "other", "than", "its", "over", "very", "such", "more", "some", "each",
  "which", "how", "most", "just", "need", "able", "working", "within",
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
  "drive", "driving", "lead", "leading", "ensure", "ensuring",
  "help", "want", "like", "would", "could", "may", "might",
  "since", "still", "while", "then", "there", "here", "much",
  "many", "those", "these", "being", "having", "doing", "going",
  "make", "take", "own", "per", "via", "through", "along",
  "whether", "based", "high", "low", "great", "key", "core",
  "deep", "wide", "full", "true", "real", "able", "available",
  "minimum", "maximum", "ideal", "clear", "simple", "complex",
  "innovative", "diverse", "exceptional", "interactive", "top-tier",
  "bairesdev", "grade", "tier", "applications", "enhance",
  "deliverables", "domain", "evaluate", "assess", "scalability",
  "responsive", "software", "models", "code",
  "research", "analysis", "analytical", "written", "verbal",
  "interpersonal", "detail-oriented", "self-motivated",
  "proactive", "passionate", "driven", "enthusiastic", "curious",
  "interfaces", "front-end", "front", "implement",
]);

const STRONG_VERBS = [
  "led", "architected", "built", "designed", "implemented",
  "optimized", "reduced", "increased", "launched", "scaled",
  "developed", "created", "managed", "spearheaded", "delivered",
  "achieved", "established", "drove", "transformed", "automated",
];

function preprocess(text: string): string {
  return text.toLowerCase().replace(/[^\w\s+#.\-@/]/g, " ").replace(/\s+/g, " ").trim();
}

function extractKeywords(text: string): string[] {
  const tokens = text.match(/[a-z][a-z+#.\-]{2,}/g) || [];
  const freq: Record<string, number> = {};
  for (const t of tokens) {
    if (!STOP_WORDS.has(t) && t.length > 2) {
      freq[t] = (freq[t] || 0) + 1;
    }
  }
  return Object.keys(freq)
    .sort((a, b) => freq[b] - freq[a])
    .slice(0, 30);
}

function keywordMatchScore(resume: string, jd: string): number {
  const jdKeywords = extractKeywords(jd);
  if (!jdKeywords.length) return 0.5;
  const resumeTokens = new Set(resume.split(" "));
  let matches = 0;
  for (const kw of jdKeywords) {
    if (resumeTokens.has(kw) || resume.includes(kw)) {
      matches += 1;
    }
  }
  return Math.min(1, matches / jdKeywords.length);
}

function sectionCompleteness(resumeText: string): number {
  const sections: Record<string, RegExp> = {
    contact: /(phone|email|linkedin|address|location|@)/i,
    summary: /(summary|objective|about|profile|professional)/i,
    experience: /(experience|employment|work history|professional)/i,
    education: /(education|academic|degree|university|college|bachelor|master)/i,
    skills: /(skills|technologies|competencies|expertise|proficient)/i,
  };
  let found = 0;
  for (const pattern of Object.values(sections)) {
    if (pattern.test(resumeText)) found++;
  }
  return found / Object.keys(sections).length;
}

function impactDensity(resume: string): number {
  const bullets = resume.split(/[\n\-•]/);
  let strong = 0;
  let total = 0;
  for (const b of bullets) {
    const s = b.trim();
    if (s.length < 10) continue;
    total++;
    let score = 0;
    if (/\d+%?|\$\d+|\d+\s*(k|m|billion|million)/i.test(s)) score += 0.5;
    if (STRONG_VERBS.some((v) => s.toLowerCase().includes(v))) score += 0.5;
    if (score >= 0.5) strong++;
  }
  return total > 0 ? strong / total : 0;
}

export function scoreResumeAgainstJD(resumeText: string, jdText: string): {
  overallScore: number;
  matchedKeywords: { keyword: string; frequency: number }[];
  missingKeywords: { keyword: string; importance: string; suggestion: string }[];
  suggestions: { category: string; priority: string; message: string }[];
} {
  const resumeClean = preprocess(resumeText);
  const jdClean = preprocess(jdText);

  const kwScore = keywordMatchScore(resumeClean, jdClean);
  const secScore = sectionCompleteness(resumeText);
  const impScore = impactDensity(resumeClean);
  const formatScore = 0.85;

  const semanticScore = (() => {
    const rw = new Set(resumeClean.split(" "));
    const jw = new Set(jdClean.split(" "));
    if (!jw.size) return 0;
    let overlap = 0;
    for (const w of jw) {
      if (rw.has(w)) overlap++;
    }
    return jw.size > 0 ? Math.min(1, overlap / jw.size) : 0;
  })();

  const total =
    kwScore * 0.30 +
    semanticScore * 0.25 +
    secScore * 0.20 +
    formatScore * 0.15 +
    impScore * 0.10;

  const overallScore = Math.round(total * 100);

  const jdKw = extractKeywords(jdClean);
  const matched: { keyword: string; frequency: number }[] = [];
  const missing: { keyword: string; importance: string; suggestion: string }[] = [];

  for (const kw of jdKw) {
    if (resumeClean.includes(kw)) {
      matched.push({ keyword: kw, frequency: (resumeClean.match(new RegExp(kw, "g")) || []).length });
    }
  }

  for (const kw of jdKw.slice(0, 20)) {
    if (!resumeClean.includes(kw)) {
      missing.push({ keyword: kw, importance: "required", suggestion: `Add '${kw}' where truthful` });
    }
  }

  const suggestions: { category: string; priority: string; message: string }[] = [];
  if (missing.length > 0) {
    suggestions.push({
      category: "skills",
      priority: "high",
      message: `Add these keywords: ${missing.slice(0, 6).map((m) => m.keyword).join(", ")}`,
    });
  }
  if (impScore < 0.4) {
    suggestions.push({
      category: "experience",
      priority: "high",
      message: "Quantify impact in your bullets (e.g., 'reduced latency by 40%')",
    });
  }
  if (secScore < 0.6) {
    suggestions.push({
      category: "structure",
      priority: "medium",
      message: "Add missing sections: summary, skills, or education",
    });
  }

  return { overallScore, matchedKeywords: matched, missingKeywords: missing, suggestions };
}
