import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ResumeForge - AI-Powered Resume Editor',
  description: 'One-click resume optimization. Tailor your resume to any job posting with AI-powered LaTeX editing.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}