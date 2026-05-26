import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerkAppearance";
import { clerkConfigured, clerkPublishableKey } from "@/lib/clerkConfig";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fluxpage — AI Resume Tailoring Platform",
  description:
    "Tailor your resume to any job in 30 seconds. AI-powered ATS optimization, cover letters, job tracking, and more.",
  keywords: [
    "resume",
    "ATS",
    "job application",
    "AI",
    "cover letter",
    "resume builder",
    "interview prep",
    "fluxpage",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const shell = (
    <html lang="en">
      <head>
        <link rel="icon" href="/brand/logo-mark.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/brand/logo-mark.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans antialiased bg-background text-foreground">
        {!clerkConfigured && process.env.NODE_ENV === "production" && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-900">
            Auth is not configured yet. Set Clerk environment variables in your host to enable sign-in.
          </div>
        )}
        {children}
      </body>
    </html>
  );

  if (!clerkConfigured || !clerkPublishableKey) {
    return shell;
  }

  return (
    <ClerkProvider appearance={clerkAppearance} publishableKey={clerkPublishableKey}>
      {shell}
    </ClerkProvider>
  );
}
