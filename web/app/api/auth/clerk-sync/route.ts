import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://canny-woodpecker-211.convex.site";

export async function POST() {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ detail: "Not signed in" }, { status: 401 });
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ detail: "User not found" }, { status: 401 });
  }

  const email =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress || user.emailAddresses[0]?.emailAddress;

  if (!email) {
    return NextResponse.json({ detail: "No email on Clerk account" }, { status: 400 });
  }

  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    undefined;

  const syncSecret = process.env.CLERK_SYNC_SECRET;
  if (!syncSecret) {
    return NextResponse.json({ detail: "CLERK_SYNC_SECRET not configured" }, { status: 500 });
  }

  const res = await fetch(`${API_URL}/v1/auth/clerk-sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      syncSecret,
      clerkId: userId,
      email,
      name,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Convex sync failed" }));
    return NextResponse.json(err, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
