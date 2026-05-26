/** Clerk light theme aligned with Fluxpage sky/violet brand */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#0369A1",
    colorDanger: "#DC2626",
    colorSuccess: "#16A34A",
    colorWarning: "#D97706",
    colorBackground: "#FFFFFF",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#0B1220",
    colorText: "#0B1220",
    colorTextSecondary: "#64748B",
    colorNeutral: "#0B1220",
    borderRadius: "0.625rem",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  elements: {
    rootBox: "mx-auto w-full max-w-[420px]",
    cardBox: "mx-auto w-full",
    card: "bg-white border border-border shadow-card mx-auto w-full",
    headerTitle: "text-foreground font-semibold",
    headerSubtitle: "text-muted",
    socialButtonsBlockButton:
      "border border-border bg-white text-foreground hover:bg-slate-50",
    formButtonPrimary:
      "bg-primary hover:bg-primary-hover text-white font-semibold shadow-sm",
    formFieldInput:
      "bg-white border-border text-foreground placeholder:text-slate-400",
    footerActionLink: "text-primary hover:text-primary-hover",
    identityPreviewEditButton: "text-primary",
    dividerLine: "bg-border",
    dividerText: "text-muted",
  },
};

export const clerkAuthShellClass =
  "min-h-screen flex bg-background";
