"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "en" | "es";
type Theme = "light" | "dark";

interface AppContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const loginTranslations = {
  en: {
    title: "Secure Access",
    subtitle: "Please enter the password to access the Semillero AI Recruitment Platform.",
    placeholder: "Enter password",
    button: "Unlock",
    error: "Incorrect password",
    required: "Password is required",
    unlocking: "Unlocking...",
  },
  es: {
    title: "Acceso Seguro",
    subtitle: "Por favor ingrese la contraseña para acceder a la Plataforma de Reclutamiento Semillero IA.",
    placeholder: "Ingrese la contraseña",
    button: "Desbloquear",
    error: "Contraseña incorrecta",
    required: "La contraseña es requerida",
    unlocking: "Desbloqueando...",
  }
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const storedLang = localStorage.getItem("lang") as Language;
    const storedTheme = localStorage.getItem("theme") as Theme;
    const sessionTime = localStorage.getItem("auth_session_time");

    setTimeout(() => {
      if (storedLang === "en" || storedLang === "es") {
        setLangState(storedLang);
      }

      if (storedTheme === "light" || storedTheme === "dark") {
        setThemeState(storedTheme);
      } else {
        // Check system preference
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        if (mediaQuery.matches) {
          setThemeState("dark");
        }
      }

      // Check auth session: auto log off after 24 hours (1 day)
      if (sessionTime) {
        const lastSession = parseInt(sessionTime, 10);
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (Date.now() - lastSession < oneDayMs) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem("auth_session_time");
        }
      }

      setMounted(true);
    }, 0);
  }, []);

  // Sync theme to document element
  useEffect(() => {
    if (!mounted) return;
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme, mounted]);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("lang", newLang);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg(lang === "es" ? loginTranslations.es.required : loginTranslations.en.required);
      return;
    }

    setLoadingAuth(true);
    setErrorMsg("");

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        localStorage.setItem("auth_session_time", Date.now().toString());
        setIsAuthenticated(true);
      } else {
        await response.json();
        setErrorMsg(lang === "es" ? loginTranslations.es.error : loginTranslations.en.error);
      }
    } catch (err) {
      console.error("Authentication failed:", err);
      setErrorMsg("Connection error. Please try again.");
    } finally {
      setLoadingAuth(false);
    }
  };

  const t = lang === "es" ? loginTranslations.es : loginTranslations.en;

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AppContext.Provider value={{ lang, setLang, theme, setTheme }}>
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-200 relative font-sans">
          {/* Top-right Language and Theme Controls */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {/* Language Selector */}
            <button
              onClick={() => setLang(lang === "en" ? "es" : "en")}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition duration-150 cursor-pointer"
            >
              {lang === "en" ? "Español (ES)" : "English (EN)"}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition duration-150 cursor-pointer"
            >
              {theme === "light" ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4.5 h-4.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4.5 h-4.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21M4.22 4.22l1.59 1.59m12.38 12.38l1.59 1.59M3 12h2.25m13.5 0H21M6.09 18.36l1.59-1.59m12.38-12.38l-1.59 1.59M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z" />
                </svg>
              )}
            </button>
          </div>

          {/* Login Lock Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm p-8 max-w-sm w-full flex flex-col gap-5 transition-colors duration-200">
            <div className="flex flex-col items-center text-center gap-2">
              {/* Shield Lock Icon */}
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/40 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0V10.5m-2.25 10.5h13.5c.621 0 1.125-.504 1.125-1.125V11.25c0-.621-.504-1.125-1.125-1.125H5.25c-.621 0-1.125.504-1.125 1.125v7.875c0 .621.504 1.125 1.125 1.125Z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {t.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal max-w-[280px]">
                {t.subtitle}
              </p>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.placeholder}
                  disabled={loadingAuth}
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/40 text-sm focus:outline-none focus:border-blue-500 dark:focus:border-blue-500/80 transition duration-150"
                  autoFocus
                />
                {errorMsg && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-0.5">
                    {errorMsg}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loadingAuth}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm rounded-md transition duration-200 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {loadingAuth ? t.unlocking : t.button}
              </button>
            </form>
          </div>
        </div>
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider value={{ lang, setLang, theme, setTheme }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
