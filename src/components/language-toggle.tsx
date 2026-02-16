"use client";

import { useLanguage } from "@/components/language-provider";

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="card inline-flex items-center gap-1 p-1" aria-label="Language switcher">
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={language === "en" ? "primary-btn !px-3 !py-1.5 !text-xs" : "soft-btn !px-3 !py-1.5 !text-xs border-transparent"}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage("ar")}
        className={language === "ar" ? "primary-btn !px-3 !py-1.5 !text-xs" : "soft-btn !px-3 !py-1.5 !text-xs border-transparent"}
      >
        AR
      </button>
    </div>
  );
}
