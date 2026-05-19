import { NextResponse } from "next/server";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.js";

export async function POST(req: Request) {
  try {
    const { base64 } = await req.json();
    if (!base64) {
      return NextResponse.json({ error: "Missing base64 data" }, { status: 400 });
    }

    const base64Data = base64.replace(/^data:application\/pdf;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const data = new Uint8Array(buffer);

    const pdf = await getDocument({ data }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str || "").join(" ");
      fullText += pageText + "\n";
    }

    return NextResponse.json({ text: fullText });
  } catch (error: any) {
    console.error("PDF parse error:", error);
    return NextResponse.json({ text: "", error: error.message });
  }
}