import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { pathToFileURL } from "url";
import { assertReadableResumeText, sanitizeResumeText } from "@/lib/textValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://canny-woodpecker-211.convex.site";
const LOCAL_PDF_API = process.env.LOCAL_PDF_API || "http://localhost:8000";

function fileToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const cjsPath = path.join(process.cwd(), "lib", "pdfExtract.cjs");
  const mod = await import(
    /* webpackIgnore: true */
    pathToFileURL(cjsPath).href
  );
  const extract = mod.extractPdfText as (buf: ArrayBuffer) => Promise<string>;
  const text = await extract(buffer);
  return sanitizeResumeText(text);
}

async function parsePdf(buffer: ArrayBuffer): Promise<string> {
  const errors: string[] = [];

  try {
    const text = await extractPdfText(buffer);
    if (text.length >= 50) return assertReadableResumeText(text, "PDF");
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "pdf.js failed");
  }

  try {
    const base64 = fileToBase64(buffer);
    const res = await fetch(`${LOCAL_PDF_API}/v1/pdf/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64 }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.text && data.text.length > 50) {
        return assertReadableResumeText(data.text, "PDF");
      }
    }
  } catch {
    /* optional local backend */
  }

  try {
    const base64 = fileToBase64(buffer);
    const res = await fetch(`${API_URL}/v1/pdf/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64 }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.text && data.text.length > 50) {
        return assertReadableResumeText(data.text, "PDF");
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "remote parse failed");
  }

  throw new Error(
    errors[0] ||
      "Could not extract text from PDF. Try a text-based PDF or upload .docx/.txt instead."
  );
}

async function parseDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  const text = sanitizeResumeText(result.value || "");
  if (text.length < 20) {
    throw new Error("DOCX file appears empty or unreadable.");
  }
  return assertReadableResumeText(text, "DOCX");
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const name = file.name.toLowerCase();
    let text = "";

    if (name.endsWith(".txt") || file.type === "text/plain") {
      text = sanitizeResumeText(new TextDecoder().decode(buffer));
      text = assertReadableResumeText(text, "TXT");
    } else if (name.endsWith(".pdf") || file.type === "application/pdf") {
      text = await parsePdf(buffer);
    } else if (
      name.endsWith(".docx") ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      text = await parseDocx(buffer);
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF, DOCX, or TXT." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      text,
      textPreview: text.slice(0, 500),
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Parse failed";
    console.error("[parse-resume]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
