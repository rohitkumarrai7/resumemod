"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Logo, Button, Card, PricingGrid } from "@/components/ui";
import Link from "next/link";

const FEATURES = [
  {
    title: "30-Second Tailoring",
    description: "AI rewrites your resume bullets to match any job description. Watch your ATS score climb from 62% to 89% in real time.",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    title: "Smart Job Insights",
    description: "Extension detects job postings on LinkedIn, Indeed, Naukri, and more. Extracts requirements, skills, and company details instantly.",
    icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  },
  {
    title: "ATS Score Engine",
    description: "Weighted scoring across keyword match, semantic similarity, section completeness, impact density, and formatting compliance.",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    title: "Cover Letters",
    description: "AI generates personalized cover letters in 4 tones: concise, confident, technical, or warm. Matched to your resume and the JD.",
    icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  },
  {
    title: "LaTeX Editor",
    description: "Monaco-powered LaTeX editor with live PDF preview, auto-compile, Overleaf export, and AI optimization. Pixel-perfect resumes.",
    icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
  },
  {
    title: "Kanban Job Tracker",
    description: "Drag-and-drop pipeline from Wishlist to Offer. Notes, contacts, deadlines, and linked documents per application.",
    icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7",
  },
];

const STEPS = [
  { step: "1", title: "Save a job", desc: "Use the Chrome extension on LinkedIn, Indeed, or Naukri to capture any posting." },
  { step: "2", title: "Tailor your resume", desc: "AI rewrites bullets and boosts your ATS score in under 30 seconds." },
  { step: "3", title: "Track your pipeline", desc: "Move applications through kanban stages from Wishlist to Offer." },
];

const TESTIMONIALS = [
  { quote: "Went from 3% response rate to 18% in two weeks. The ATS score feedback is a game changer.", name: "Priya S.", role: "Software Engineer" },
  { quote: "I used to spend an hour per application. Now it's 5 minutes with a tailored resume and cover letter.", name: "Marcus T.", role: "Product Manager" },
  { quote: "The extension on LinkedIn is seamless. Save job, tailor, apply — all without leaving the tab.", name: "Ananya K.", role: "Data Analyst" },
];

const FAQ = [
  { q: "How does AI resume tailoring work?", a: "Fluxpage analyzes the job description, identifies keyword gaps, and rewrites your resume bullets to match — while keeping your experience truthful." },
  { q: "What is an ATS score?", a: "An ATS (Applicant Tracking System) score measures how well your resume matches a job posting across keywords, semantics, formatting, and impact." },
  { q: "Does the Chrome extension work on all job sites?", a: "Yes — LinkedIn, Indeed, Naukri, Glassdoor, and most major job boards. The extension detects job pages automatically." },
  { q: "Is my resume data secure?", a: "Your data is encrypted in transit and at rest. We never share your resume with third parties or use it to train public models." },
  { q: "What's included in the free plan?", a: "5 AI tailors per month, 3 resumes, basic job tracker, PDF export, and ATS scoring — no credit card required." },
  { q: "Can I export to PDF and DOCX?", a: "PDF export is free. DOCX export is available on Pro and Premium plans." },
];

const DEMO_TABS = ["Insights", "Generate", "Track"] as const;

function ProductMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-3xl blur-2xl" />
      <Card className="relative overflow-hidden" padding="none">
        <div className="bg-slate-100 border-b border-border px-4 py-2.5 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
          </div>
          <div className="flex-1 mx-4 bg-white rounded-md px-3 py-1 text-xs text-muted truncate border border-border">
            linkedin.com/jobs/view/senior-software-engineer
          </div>
        </div>
        <div className="flex">
          <div className="flex-1 p-5 bg-white min-h-[280px]">
            <div className="space-y-3">
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
              <div className="h-3 bg-slate-100 rounded w-full mt-4" />
              <div className="h-3 bg-slate-100 rounded w-full" />
              <div className="h-3 bg-slate-100 rounded w-5/6" />
            </div>
          </div>
          <div className="w-52 border-l border-border bg-slate-50 p-4">
            <div className="text-xs font-semibold text-foreground mb-3">Fluxpage</div>
            <div className="relative w-16 h-16 mx-auto mb-3">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="42" fill="none" stroke="#E2E8F0" strokeWidth="6" />
                <circle cx="48" cy="48" r="42" fill="none" stroke="#059669" strokeWidth="6" strokeDasharray="235 264" strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-success">89</span>
            </div>
            <div className="text-center text-xs text-muted mb-3">ATS Match Score</div>
            <div className="flex flex-wrap gap-1">
              {["React", "TypeScript", "Node.js"].map((k) => (
                <span key={k} className="px-1.5 py-0.5 bg-emerald-50 text-success text-[10px] rounded">{k}</span>
              ))}
              {["AWS"].map((k) => (
                <span key={k} className="px-1.5 py-0.5 bg-red-50 text-danger text-[10px] rounded">{k}</span>
              ))}
            </div>
            <Button size="sm" className="w-full mt-4">Tailor Resume</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [demoTab, setDemoTab] = useState<(typeof DEMO_TABS)[number]>("Insights");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    setIsLoggedIn(api.auth.isLoggedIn());
  }, []);

  const ctaHref = isLoggedIn ? "/dashboard" : "/register";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-surface/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Logo />
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-muted hover:text-foreground transition-colors">Pricing</a>
            <a href="#reviews" className="text-sm text-muted hover:text-foreground transition-colors">Reviews</a>
            {isLoggedIn ? (
              <Button href="/dashboard" size="sm">Dashboard</Button>
            ) : (
              <>
                <Link href="/login" className="text-sm text-muted hover:text-foreground transition-colors">Sign In</Link>
                <Button href="/register" size="sm">Get Started Free</Button>
              </>
            )}
          </div>
          <button
            className="md:hidden p-2 text-muted hover:text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-surface px-4 py-4 space-y-3">
            <a href="#features" className="block text-sm text-muted" onClick={() => setMobileOpen(false)}>Features</a>
            <a href="#pricing" className="block text-sm text-muted" onClick={() => setMobileOpen(false)}>Pricing</a>
            <a href="#reviews" className="block text-sm text-muted" onClick={() => setMobileOpen(false)}>Reviews</a>
            {isLoggedIn ? (
              <Button href="/dashboard" size="sm" className="w-full">Dashboard</Button>
            ) : (
              <>
                <Link href="/login" className="block text-sm text-muted">Sign In</Link>
                <Button href="/register" size="sm" className="w-full">Get Started Free</Button>
              </>
            )}
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 border border-primary/20 text-primary text-sm mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              AI-Powered Resume Platform
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight mb-6">
              Tailor Your Resume in{" "}
              <span className="text-primary">30 Seconds</span>
            </h1>
            <p className="text-lg text-muted mb-8 leading-relaxed max-w-lg">
              Stop spending hours customizing resumes. AI tailors your resume to any job posting,
              generates cover letters, and tracks applications — all from one platform.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button href={ctaHref} size="lg">Get Started Free</Button>
              <Button href="#demo" variant="secondary" size="lg">See It In Action</Button>
            </div>
            <p className="text-muted text-sm mt-4">
              No credit card · 5 free tailors/month · Works on LinkedIn, Indeed, Naukri
            </p>
          </div>
          <ProductMockup />
        </div>
      </section>

      {/* See It In Action */}
      <section id="demo" className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-3">See It In Action</h2>
          <p className="text-muted">From job discovery to offer — one seamless workflow.</p>
        </div>
        <div className="flex justify-center gap-2 mb-6">
          {DEMO_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setDemoTab(tab)}
              className={`px-4 py-2 rounded-button text-sm font-medium transition-colors ${
                demoTab === tab ? "bg-primary text-white" : "bg-slate-100 text-muted hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <Card padding="lg">
          {demoTab === "Insights" && (
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="font-semibold text-lg mb-2">Instant job analysis</h3>
                <p className="text-muted text-sm leading-relaxed">Paste any job URL or use the extension. Fluxpage extracts skills, requirements, and keyword gaps in seconds.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Python", "Kubernetes", "CI/CD", "Agile"].map((k) => (
                    <span key={k} className="px-2 py-1 bg-primary-50 text-primary text-xs rounded-full font-medium">{k}</span>
                  ))}
                </div>
              </div>
              <div className="flex justify-center">
                <div className="relative w-28 h-28">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="42" fill="none" stroke="#E2E8F0" strokeWidth="6" />
                    <circle cx="48" cy="48" r="42" fill="none" stroke="#0369A1" strokeWidth="6" strokeDasharray="185 264" strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-2xl font-black text-primary">70</span>
                </div>
              </div>
            </div>
          )}
          {demoTab === "Generate" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">AI-generated suggestions</h3>
              <div className="space-y-2">
                {["Added 'microservices' to experience bullet", "Quantified impact: 'Reduced latency by 40%'", "Matched 'TypeScript' in skills section"].map((s) => (
                  <div key={s} className="flex items-start gap-2 text-sm">
                    <svg className="w-5 h-5 text-success flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-foreground">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {demoTab === "Track" && (
            <div className="grid grid-cols-4 gap-3">
              {["Wishlist", "Applied", "Interview", "Offer"].map((stage, i) => (
                <div key={stage} className="bg-slate-50 rounded-lg p-3 border border-border">
                  <div className="text-xs font-medium text-muted mb-2">{stage}</div>
                  {i < 2 && (
                    <div className="bg-white rounded border border-border p-2 text-xs">
                      <div className="font-medium truncate">Senior SWE</div>
                      <div className="text-muted truncate">Acme Corp</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 border-y border-border py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">How It Works</h2>
            <p className="text-muted">Three steps to better applications.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-10 h-10 rounded-full bg-primary text-white font-bold flex items-center justify-center mx-auto mb-4">{s.step}</div>
                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-muted text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Everything You Need to Land Interviews</h2>
          <p className="text-muted max-w-xl mx-auto">From resume tailoring to interview prep — one platform for your entire job search.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <Card key={f.title} hover padding="md">
              <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-muted text-sm leading-relaxed">{f.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section id="reviews" className="bg-slate-50 border-y border-border py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Loved by Job Seekers</h2>
            <p className="text-muted">Real results from people who stopped guessing and started tailoring.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name} padding="md">
                <p className="text-foreground text-sm leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-muted">{t.role}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Frequently Asked Questions</h2>
        </div>
        <div className="space-y-3">
          {FAQ.map((item, i) => (
            <Card key={item.q} padding="none" className="overflow-hidden">
              <button
                className="w-full px-6 py-4 flex items-center justify-between text-left"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="font-medium text-foreground pr-4">{item.q}</span>
                <svg
                  className={`w-5 h-5 text-muted flex-shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openFaq === i && (
                <div className="px-6 pb-4 text-sm text-muted leading-relaxed">{item.a}</div>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Simple, Transparent Pricing</h2>
          <p className="text-muted">Start free. Upgrade when you need more power.</p>
        </div>
        <PricingGrid isLoggedIn={isLoggedIn} />
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-20">
        <div className="bg-primary rounded-card p-10 sm:p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-3">Ready to Land Your Dream Job?</h2>
          <p className="text-sky-100 mb-6 max-w-lg mx-auto">
            Join job seekers getting more interviews with AI-tailored applications.
          </p>
          <Button href={ctaHref} variant="secondary" size="lg" className="bg-white text-primary hover:bg-slate-50">
            Start Free Today
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <Logo />
              <p className="text-sm text-muted mt-3">AI resume tailoring for modern job seekers.</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted">
                <li><a href="#features" className="hover:text-foreground">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
                <li><Link href="/register" className="hover:text-foreground">Get Started</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-muted">
                <li><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Contact</h4>
              <ul className="space-y-2 text-sm text-muted">
                <li><a href="mailto:support@fluxpage.com" className="hover:text-foreground">support@fluxpage.com</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-6 text-xs text-muted">
            &copy; 2026 Fluxpage. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
