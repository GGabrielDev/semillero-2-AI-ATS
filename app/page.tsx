import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-sm border border-slate-200 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          AI Recruitment Platform
        </h1>
        <p className="text-slate-600 mb-6 text-sm">
          Welcome to the ATS. Access your workspace below.
        </p>
        <Link
          href="/jobs"
          className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors text-sm"
        >
          Go to Dashboard
        </Link>
      </div>
    </main>
  );
}
