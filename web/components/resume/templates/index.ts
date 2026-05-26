import type { StructuredResume } from "@/lib/resumeParser";

export type TemplateVariant = "classic" | "compact" | "modern";

export interface TemplateStyles {
  accent: string;
  nameSize: number;
  sectionSize: number;
  bodySize: number;
  pagePadding: number;
  sectionGap: number;
}

export const TEMPLATE_STYLES: Record<TemplateVariant, TemplateStyles> = {
  classic: {
    accent: "#1E3A5F",
    nameSize: 18,
    sectionSize: 11,
    bodySize: 10,
    pagePadding: 40,
    sectionGap: 10,
  },
  compact: {
    accent: "#111827",
    nameSize: 16,
    sectionSize: 10,
    bodySize: 9,
    pagePadding: 32,
    sectionGap: 6,
  },
  modern: {
    accent: "#6366F1",
    nameSize: 20,
    sectionSize: 11,
    bodySize: 10,
    pagePadding: 36,
    sectionGap: 8,
  },
};

export function slugToVariant(slug: string): TemplateVariant {
  if (slug.includes("compact")) return "compact";
  if (slug.includes("modern")) return "modern";
  return "classic";
}

export function variantToSlug(variant: TemplateVariant): string {
  return `${variant === "classic" ? "classic" : variant}-ats`;
}

export type { StructuredResume };
