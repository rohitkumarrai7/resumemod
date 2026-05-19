"use client";

export default function AnalyticsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 mt-1">Track your application progress and ATS scores</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Application Funnel</h2>
          <div className="space-y-3">
            {["Saved", "Applied", "Interview", "Offer"].map((stage, i) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-600 w-20">{stage}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full" style={{ width: `${[100, 60, 30, 10][i]}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-4">ATS Score Trend</h2>
          <div className="flex items-center justify-center h-48 text-slate-300 text-sm">
            Score trend chart will appear here after analyses
          </div>
        </div>
      </div>
    </div>
  );
}
