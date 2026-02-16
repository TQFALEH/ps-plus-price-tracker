"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Language = "en" | "ar";

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("psplus-language") : null;
    if (saved === "ar" || saved === "en") {
      setLanguage(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem("psplus-language", language);

    const html = document.documentElement;
    html.lang = language;
    html.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return ctx;
}
