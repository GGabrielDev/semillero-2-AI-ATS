import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 transition-colors duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 p-8 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 text-center transition-colors duration-200">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          AI Recruitment Platform
        </h1>
        <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm">
          Welcome to the ATS. Access your workspace below.
        </p>
        <Link
          href="/jobs"
          className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors text-sm cursor-pointer"
        >
          Go to Workspace
        </Link>
      </div>
    </main>
  );
}
