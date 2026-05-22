import { NextResponse } from "next/server";

export async function POST(req: Request) {
  return NextResponse.json({ error: "PDF parsing is done by the Chrome extension" }, { status: 501 });
}