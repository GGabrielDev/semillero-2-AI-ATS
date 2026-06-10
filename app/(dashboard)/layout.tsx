"use client";

import Link from "next/link";
import { useApp } from "@/components/AppContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { lang, setLang, theme, setTheme } = useApp();

  const toggleLanguage = () => {
    setLang(lang === "en" ? "es" : "en");
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors duration-200">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-slate-900 dark:text-white font-bold text-lg">
              {lang === "en" ? "AI Recruitment" : "Reclutamiento IA"}
            </span>
            <nav className="flex gap-4">
              <Link
                href="/jobs"
                className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium transition-colors"
              >
                {lang === "en" ? "Jobs" : "Vacantes"}
              </Link>
              <Link
                href="/candidates"
                className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium transition-colors"
              >
                {lang === "en" ? "Candidates" : "Candidatos"}
              </Link>
              <Link
                href="/interviews"
                className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium transition-colors"
              >
                {lang === "en" ? "Interviews" : "Entrevistas"}
              </Link>
              {process.env.NODE_ENV !== "production" && (
                <Link
                  href="/workflows"
                  className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium transition-colors"
                >
                  {lang === "en" ? "Workflows" : "Flujos de Trabajo"}
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className="h-8 px-2.5 text-xs font-bold rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors flex items-center justify-center cursor-pointer"
              title={lang === "en" ? "Language: English (Click to switch to Spanish)" : "Idioma: Español (Clic para cambiar a Inglés)"}
            >
              {lang === "en" ? "EN" : "ES"}
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="h-8 w-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors flex items-center justify-center cursor-pointer"
              aria-label={lang === "en" ? "Toggle theme" : "Cambiar tema"}
              title={lang === "en" ? "Toggle light/dark mode" : "Cambiar modo claro/oscuro"}
            >
              {theme === "light" ? (
                // Moon Icon
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                  />
                </svg>
              ) : (
                // Sun Icon
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v2.25m0 13.5V21M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M3 12h2.25m13.5 0H21M5.75 12a6.25 6.25 0 1112.5 0 6.25 6.25 0 01-12.5 0z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 sm:p-8">
        {children}
      </main>
    </div>
  );
}
