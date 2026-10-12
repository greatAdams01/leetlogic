"use client";
import { createContext, useContext, useEffect, useState } from "react";
import {
  languageNames,
  locales,
  message,
  validLocale,
  type Locale,
  type MessageKey,
} from "../lib/locales/messages";
import { customerApi } from "../lib/customer-api";
const LanguageContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
}>({ locale: "en", setLocale: () => {}, t: (key) => message("en", key) });
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [locale, updateLocale] = useState<Locale>("en");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  useEffect(() => {
    const saved = document.cookie
      .split("; ")
      .find((x) => x.startsWith("ll_locale="))
      ?.split("=")[1];
    updateLocale(validLocale(saved));
    setReady(true);
    customerApi("me")
      .then(({ user }) => {
        if (user) updateLocale(validLocale(user.preferredLocale));
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = locale;
    document.cookie = `ll_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    const controller = new AbortController();
    setOverrides({});
    const load = () =>
      fetch(`/api/content/translations?locale=${locale}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.messages) setOverrides(data.messages);
        })
        .catch(() => {});
    void load();
    const timer = window.setInterval(load, 60000);
    window.addEventListener("focus", load);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [locale, ready]);
  const setLocale = (next: Locale) => {
    updateLocale(next);
    customerApi("me/locale", { locale: next }, "PATCH").catch(() => {});
  };
  return (
    <LanguageContext.Provider
      value={{ locale, setLocale, t: (key) => message(locale, key, overrides) }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
export const useLanguage = () => useContext(LanguageContext);
export function LanguageSelector() {
  const { locale, setLocale, t } = useLanguage();
  return (
    <label className="language-selector">
      <span className="sr-only">{t("common.language")}</span>
      <select
        aria-label={t("common.language")}
        value={locale}
        onChange={(e) => setLocale(validLocale(e.target.value))}
      >
        {locales.map((x) => (
          <option key={x} value={x}>
            {languageNames[x]}
          </option>
        ))}
      </select>
    </label>
  );
}
