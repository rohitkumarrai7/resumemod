"use client";

import dynamic from "next/dynamic";
import { clerkAppearance } from "@/lib/clerkAppearance";
import { SpinnerCenter } from "@/components/ui";

const SignIn = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignIn),
  {
    ssr: false,
    loading: () => <SpinnerCenter className="py-12" />,
  }
);

const SignUp = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignUp),
  {
    ssr: false,
    loading: () => <SpinnerCenter className="py-12" />,
  }
);

interface ClerkSignInProps {
  signUpUrl: string;
  forceRedirectUrl: string;
}

interface ClerkSignUpProps {
  signInUrl: string;
  forceRedirectUrl: string;
}

export function ClerkSignInForm({ signUpUrl, forceRedirectUrl }: ClerkSignInProps) {
  return (
    <SignIn
      appearance={clerkAppearance}
      routing="path"
      path="/login"
      signUpUrl={signUpUrl}
      forceRedirectUrl={forceRedirectUrl}
    />
  );
}

export function ClerkSignUpForm({ signInUrl, forceRedirectUrl }: ClerkSignUpProps) {
  return (
    <SignUp
      appearance={clerkAppearance}
      routing="path"
      path="/register"
      signInUrl={signInUrl}
      forceRedirectUrl={forceRedirectUrl}
    />
  );
}
