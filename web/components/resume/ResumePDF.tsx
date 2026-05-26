"use client";

import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type { StructuredResume } from "@/lib/resumeParser";
import { TEMPLATE_STYLES, type TemplateVariant } from "./templates";

function buildStyles(template: TemplateVariant) {
  const t = TEMPLATE_STYLES[template];
  return StyleSheet.create({
    page: {
      padding: t.pagePadding,
      fontSize: t.bodySize,
      fontFamily: "Helvetica",
      color: "#111827",
    },
    header: {
      textAlign: template === "modern" ? "left" : "center",
      marginBottom: template === "compact" ? 12 : 16,
      borderBottomWidth: 1,
      borderBottomColor: t.accent,
      paddingBottom: 8,
    },
    name: { fontSize: t.nameSize, fontWeight: "bold", color: t.accent },
    contact: { fontSize: t.bodySize - 1, color: "#64748B", marginTop: 4 },
    sectionTitle: {
      fontSize: t.sectionSize,
      fontWeight: "bold",
      color: t.accent,
      marginTop: t.sectionGap,
      marginBottom: 4,
      borderBottomWidth: 0.5,
      borderBottomColor: "#CBD5E1",
      paddingBottom: 2,
    },
    bullet: { fontSize: t.bodySize, marginBottom: template === "compact" ? 2 : 3, paddingLeft: 8 },
  });
}

function ResumePDFDocument({
  resume,
  template = "classic",
}: {
  resume: StructuredResume;
  template?: TemplateVariant;
}) {
  const styles = buildStyles(template);
  const contactLine = [resume.contact.email, resume.contact.phone, resume.contact.linkedin]
    .filter(Boolean)
    .join(" · ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{resume.contact.name || "Your Name"}</Text>
          {contactLine ? <Text style={styles.contact}>{contactLine}</Text> : null}
        </View>
        {resume.sections.map((section) => (
          <View key={section.id}>
            <Text style={styles.sectionTitle}>{section.heading.toUpperCase()}</Text>
            {section.items.map((item) => (
              <Text key={item.id} style={styles.bullet}>• {item.text}</Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function downloadResumePdf(
  resume: StructuredResume,
  template: TemplateVariant = "classic",
  filename = "tailored-resume.pdf"
) {
  const blob = await pdf(<ResumePDFDocument resume={resume} template={template} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { ResumePDFDocument };
