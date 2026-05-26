"use client";

import type { StructuredResume } from "@/lib/resumeParser";

interface Props {
  resume: StructuredResume;
  template?: "classic" | "compact" | "modern";
}

export function ResumePreview({ resume, template = "classic" }: Props) {
  const accent =
    template === "modern" ? "#6366F1" : template === "compact" ? "#2563EB" : "#1E3A5F";

  return (
    <div className="bg-white text-slate-900 rounded-lg shadow-lg p-8 min-h-full text-sm leading-relaxed">
      <div className="text-center border-b pb-4 mb-4" style={{ borderColor: accent }}>
        <h1 className="text-2xl font-bold" style={{ color: accent }}>
          {resume.contact.name || "Your Name"}
        </h1>
        <div className="text-xs text-slate-600 mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
          {resume.contact.email && <span>{resume.contact.email}</span>}
          {resume.contact.phone && <span>{resume.contact.phone}</span>}
          {resume.contact.linkedin && <span>{resume.contact.linkedin}</span>}
        </div>
      </div>

      {resume.sections.map((section) => (
        <div key={section.id} className="mb-4">
          <h2
            className="text-sm font-bold uppercase tracking-wide mb-2 pb-1 border-b"
            style={{ color: accent, borderColor: `${accent}33` }}
          >
            {section.heading}
          </h2>
          <ul className="space-y-1.5">
            {section.items.map((item) => (
              <li key={item.id} className="text-slate-700 pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-slate-400">
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
