import { Logo } from "@/components/ui/Logo";

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const dash = `${score * 2.64} 264`;
  return (
    <div className="text-center">
      <div className="text-xs text-muted mb-2">{label}</div>
      <div className="relative w-20 h-20 mx-auto">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="42" fill="none" stroke="#E2E8F0" strokeWidth="6" />
          <circle cx="48" cy="48" r="42" fill="none" stroke={color} strokeWidth="6" strokeDasharray={dash} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xl font-black" style={{ color }}>
          {score}
        </span>
      </div>
    </div>
  );
}

export function AuthLayout({ children, title = "Tailor smarter, land faster", subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-50 via-white to-accent-50 p-12 flex-col justify-between border-r border-border">
        <Logo size="lg" />
        <div>
          <h2 className="text-3xl font-bold text-foreground leading-tight mb-4">{title}</h2>
          <p className="text-muted text-lg leading-relaxed max-w-md">
            {subtitle ||
              "AI-powered resume tailoring with real-time ATS scoring. Match any job in 30 seconds."}
          </p>
          <div className="mt-10 bg-surface rounded-card border border-border shadow-card p-6 flex items-center justify-center gap-8">
            <ScoreRing score={62} label="Before" color="#DC2626" />
            <div className="flex flex-col items-center text-primary">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span className="text-xs font-medium mt-1">AI Tailor</span>
            </div>
            <ScoreRing score={89} label="After" color="#16A34A" />
          </div>
          <p className="text-sm text-muted mt-4">Average +27 point ATS improvement across users</p>
        </div>
        <p className="text-xs text-muted">&copy; 2026 Fluxpage. All rights reserved.</p>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[440px]">
          <div className="lg:hidden mb-8 text-center">
            <Logo size="md" className="justify-center" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
