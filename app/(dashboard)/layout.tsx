import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-slate-900 font-bold text-lg">AI Recruitment</span>
            <nav className="flex gap-4">
              <Link href="/jobs" className="text-sm text-slate-600 hover:text-slate-900 font-medium">
                Jobs
              </Link>
              <Link href="/candidates" className="text-sm text-slate-600 hover:text-slate-900 font-medium">
                Candidates
              </Link>
              <Link href="/interviews" className="text-sm text-slate-600 hover:text-slate-900 font-medium">
                Interviews
              </Link>
              <Link href="/workflows" className="text-sm text-slate-600 hover:text-slate-900 font-medium">
                Workflows
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 sm:p-8">
        {children}
      </main>
    </div>
  );
}
