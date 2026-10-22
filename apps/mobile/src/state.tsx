import { Feedback, type FeedbackMessage } from "./components/feedback";
import { LocaleProvider } from "./localization";
import { ui, localizedError, unitLabel, dateLabel, localizedStatus } from "./lib/localization";
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, BackHandler, Alert, type AlertButton } from "react-native";
import { api, hydrateSession, clearSession, authHeaders } from "./lib/api";
import type { Customer } from "./lib/domain";
import {
  en,
  validLocale,
  type Locale,
  type MessageKey,
} from "../../../packages/localization/src/customer-messages";
import { type Route, openLanguageScreen, finishLanguageSelection } from "./lib/navigation";
import { accountRoleKey, restoredAccount } from "./lib/onboarding";
const Context = createContext<any>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<Route[]>([{ name: "language" }]),
    [locale, setLocale] = useState<Locale>("en"),
    [user, setUser] = useState<Customer | null>(null),
    [ready, setReady] = useState(false),
    [role, setRole] = useState<"BUYER" | "SELLER">("BUYER"),
    [overrides, setOverrides] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const feedbackId = useRef(0);
  const localeWrites = useRef<Promise<void>>(Promise.resolve());
  const route = stack[stack.length - 1]!;
  const go = useCallback(
    (name: Route["name"], id?: string) => setStack((v) => [...v, { name, id }]),
    [],
  );
  const reset = useCallback((name: Route["name"]) => setStack([{ name }]), []);
  const back = useCallback(() => setStack((v) => (v.length > 1 ? v.slice(0, -1) : v)), []);
  const loadUser = useCallback(async () => {
    const r = await api<{ user: Customer }>("/me");
    setUser(r.user);
    return r.user;
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const l = await AsyncStorage.getItem("locale");
        if (l) setLocale(validLocale(l));
        const signed = await hydrateSession();
        if (signed) {
          try {
            const user = await loadUser();
            const preferred = validLocale(user.preferredLocale);
            setLocale(preferred);
            await AsyncStorage.setItem("locale", preferred);
            const restored = restoredAccount(
              user,
              await AsyncStorage.getItem(accountRoleKey(user.id)),
            );
            setRole(restored.role);
            reset(restored.route);
          } catch {
            await clearSession();
          }
        } else if (await AsyncStorage.getItem("onboarded")) reset("role");
      } finally {
        setReady(true);
      }
    })();
  }, [loadUser, reset]);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    const refresh = () =>
      api<{ messages: Record<string, string> }>(`/content/translations?locale=${locale}`)
        .then((r) => {
          if (active) setOverrides(r.messages);
        })
        .catch(() => {});
    void refresh();
    const timer = setInterval(refresh, 60000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refresh();
    });
    return () => {
      active = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [locale, ready]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      // The verification wizard owns Back within its separate application stages.
      if (route.name === "seller") return false;
      if (stack.length <= 1) return false;
      back();
      return true;
    });
    return () => sub.remove();
  }, [stack.length, route.name, back]);
  const changeLocale = (l: Locale) => {
    setOverrides({});
    setLocale(l);
    // Serialize writes so a slower earlier choice cannot overwrite the latest one.
    const signedIn = !!authHeaders().Authorization;
    localeWrites.current = localeWrites.current
      .catch(() => {})
      .then(async () => {
        await AsyncStorage.setItem("locale", l);
        if (signedIn && authHeaders().Authorization)
          await api("/me/locale", { method: "PATCH", body: { locale: l } });
      });
    return localeWrites.current;
  };
  const signOut = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      await clearSession();
      setUser(null);
      reset("phone");
    }
  };
  return (
    <LocaleProvider value={locale}>
      <Context.Provider
        value={{
          route,
          canGoBack: stack.length > 1,
          openLanguage: (introStep?: number) => setStack((v) => openLanguageScreen(v, introStep)),
          finishLanguage: () => setStack(finishLanguageSelection),
          go,
          back,
          reset,
          locale,
          changeLocale,
          user,
          setUser,
          loadUser,
          ready,
          role,
          setRole,
          signOut,
          notify: (text: string) => setFeedback({ id: ++feedbackId.current, text }),
          t: (key: MessageKey) => overrides[key] || ui(locale, en[key] || "Update"),
          ui: (source: string, params?: Record<string, string | number>) =>
            ui(locale, source, params),
          error: (value: unknown) => localizedError(locale, value),
          unit: (code: string) => unitLabel(locale, code),
          date: (value: string) => dateLabel(locale, value),
          status: (code: string) => localizedStatus(locale, code),
          alert: (title: string, text: string, buttons?: AlertButton[]) =>
            Alert.alert(
              ui(locale, title),
              ui(locale, text),
              buttons?.map((b) => ({ ...b, text: b.text ? ui(locale, b.text) : b.text })),
            ),
        }}
      >
        {children}
        <Feedback message={feedback} dismiss={() => setFeedback(null)} />
      </Context.Provider>
    </LocaleProvider>
  );
}
export function useApp() {
  return useContext(Context) as {
    route: Route;
    canGoBack: boolean;
    openLanguage: (introStep?: number) => void;
    finishLanguage: () => void;
    go: (name: Route["name"], id?: string) => void;
    back: () => void;
    reset: (name: Route["name"]) => void;
    locale: Locale;
    changeLocale: (l: Locale) => Promise<void>;
    user: Customer | null;
    setUser: (u: Customer | null) => void;
    loadUser: () => Promise<Customer>;
    ready: boolean;
    role: "BUYER" | "SELLER";
    setRole: (r: "BUYER" | "SELLER") => void;
    signOut: () => Promise<void>;
    notify: (text: string) => void;
    t: (key: MessageKey) => string;
    ui: (source: string, params?: Record<string, string | number>) => string;
    error: (value: unknown) => string;
    unit: (code: string) => string;
    date: (value: string) => string;
    status: (code: string) => string;
    alert: (title: string, text: string, buttons?: AlertButton[]) => void;
  };
}
export function useResource<T>(path: string) {
  const { locale } = useApp();
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api<T>(path));
    } catch (e) {
      setError(localizedError(locale, e));
    } finally {
      setLoading(false);
    }
  }, [path, locale]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, loading, reload };
}
