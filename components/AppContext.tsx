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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const storedLang = localStorage.getItem("lang") as Language;
    const storedTheme = localStorage.getItem("theme") as Theme;

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
