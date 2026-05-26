import { NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://canny-woodpecker-211.convex.site";

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return NextResponse.json(
      { detail: "Not signed in. Go to /auth/sync to connect your account." },
      { status: 401 }
    );
  }

  const res = await fetch(`${API_URL}/v1/auth/onboarding/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
  });

  const data = await res.json().catch(() => ({ detail: "Failed to complete onboarding" }));
  return NextResponse.json(data, { status: res.status });
}
