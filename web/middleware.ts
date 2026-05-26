import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkConfigured } from "@/lib/clerkConfig";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/register(.*)",
  "/extension(.*)",
  "/callback(.*)",
  "/api/(.*)",
]);

const protectedMiddleware = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth().protect();
  }
});

export default function middleware(request: NextRequest) {
  if (!clerkConfigured) {
    return NextResponse.next();
  }

  return protectedMiddleware(request, {} as never);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/).*)",
    "/(api|trpc)(.*)",
  ],
};
