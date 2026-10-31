import { Feedback, type FeedbackMessage } from "./components/feedback";
import { LocaleProvider } from "./localization";
import { ui, localizedError, unitLabel, dateLabel, localizedStatus } from "./lib/localization";
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, BackHandler, Alert, type AlertButton } from "react-native";
import {
  api,
  hydrateSession,
  clearSession,
  authHeaders,
  sessionVersion,
  deviceId,
} from "./lib/api";
import type { Customer } from "./lib/domain";
import {
  en,
  validLocale,
  type Locale,
  type MessageKey,
} from "../../../packages/localization/src/customer-messages";
import {
  type Route,
  openLanguageScreen,
  finishLanguageSelection,
  backStack,
  returnToScreen,
} from "./lib/navigation";
import { accountRoleKey, restoredAccount, signInRole } from "./lib/onboarding";
import { readSecurity } from "./lib/farmer-security";
import { singleFlight } from "./lib/async-cache";
import { needsSignIn } from "./lib/auth-errors";
const readAccount = singleFlight<number, { user: Customer }>(() => api<{ user: Customer }>("/me"));
const Context = createContext<any>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<Route[]>([{ name: "language" }]),
    [locale, setLocale] = useState<Locale>("en"),
    [user, setUser] = useState<Customer | null>(null),
    [ready, setReady] = useState(false),
    [role, setRole] = useState<"BUYER" | "SELLER">("BUYER"),
    [overrides, setOverrides] = useState<Record<string, string>>({});
  const [security, setSecurity] = useState<"create" | "unlock" | null>(null);
  const [authIntent, setAuthIntent] = useState<"LOGIN" | "REGISTER">("LOGIN");
  const recoverAccount = useRef<string | null>(null);
  const roleIntent = useRef<"BUYER" | "SELLER" | null>(null);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const feedbackId = useRef(0);
  const localeWrites = useRef<Promise<void>>(Promise.resolve());
  const route = stack[stack.length - 1]!;
  const go = useCallback(
    (name: Route["name"], id?: string, query?: string) =>
      setStack((v) => [...v, { name, id, ...(query !== undefined ? { query } : {}) }]),
    [],
  );
  const reset = useCallback((name: Route["name"]) => setStack([{ name }]), []);
  const back = useCallback(() => setStack((v) => backStack(v, !!user)), [user]);
  const loadUser = useCallback(async (publish = true) => {
    const version = sessionVersion();
    const r = await readAccount(version);
    // A completed request from an old session must not replace the current account.
    if (publish && authHeaders().Authorization && sessionVersion() === version)
      setUser((current) => (JSON.stringify(current) === JSON.stringify(r.user) ? current : r.user));
    return r.user;
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const l = await AsyncStorage.getItem("locale");
        if (l) setLocale(validLocale(l));
        const signed = await hydrateSession();
        if (signed) {
          const version = sessionVersion();
          try {
            let user: Customer;
            try {
              user = await loadUser(false);
            } catch (error) {
              if (sessionVersion() !== version) return;
              if (needsSignIn(error)) throw error;
              // Keep the encrypted session, but publish no account or dashboard until /me works.
              setStack([{ name: "otp", query: "resume-sign-in" }]);
              return;
            }
            if (sessionVersion() !== version) return;
            const preferred = validLocale(user.preferredLocale);
            setLocale(preferred);
            await AsyncStorage.setItem("locale", preferred);
            const restored = restoredAccount(
              user,
              await AsyncStorage.getItem(accountRoleKey(user.id)),
            );
            const nextSecurity =
              restored.role === "SELLER"
                ? (await readSecurity(user.id))
                  ? "unlock"
                  : "create"
                : null;
            if (sessionVersion() !== version) return;
            setSecurity(nextSecurity);
            setRole(restored.role);
            setUser(user);
            reset(restored.route);
          } catch {
            if (sessionVersion() !== version) return;
            setUser(null);
            setSecurity(null);
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
      if (route.name === "seller" && user) return false;
      if (backStack(stack, !!user) === stack) return false;
      back();
      return true;
    });
    return () => sub.remove();
  }, [stack, route.name, back, user]);
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
  const selectRole = async (selected: "BUYER" | "SELLER") => {
    if (user) {
      if (signInRole(user, null, null) !== selected)
        throw new Error("Your account role cannot be changed. Please contact support.");
      setRole(selected);
      setSecurity(selected === "SELLER" ? ((await readSecurity(user.id)) ? "unlock" : "create") : null);
      reset(restoredAccount(user, null).route);
      return;
    }
    recoverAccount.current = null;
    roleIntent.current = selected;
    setAuthIntent("REGISTER");
    setRole(selected);
    setStack([{ name: "phone", ...(route.id ? { id: route.id } : {}) }]);
  };
  const finishSignIn = async (account: Customer) => {
    const version = sessionVersion();
    const recovering = recoverAccount.current === account.id;
    const intent = roleIntent.current;
    const saved = await AsyncStorage.getItem(accountRoleKey(account.id));
    if (sessionVersion() !== version) return;
    const selected = signInRole(account, saved, recovering ? "SELLER" : intent);
    const restored = restoredAccount(account, selected);
    await AsyncStorage.setItem(accountRoleKey(account.id), restored.role);
    // OTP establishes account ownership; only explicit recovery permits replacing a PIN.
    const nextSecurity =
      restored.role === "SELLER"
        ? recovering || !(await readSecurity(account.id))
          ? "create"
          : "unlock"
        : null;
    if (sessionVersion() !== version) return;
    roleIntent.current = null;
    recoverAccount.current = null;
    setSecurity(nextSecurity);
    setRole(restored.role);
    setFeedback(null);
    // Publish the account only after the role and security gate are ready.
    setUser(account);
    reset(restored.route);
  };
  useEffect(() => {
    let backgrounded = 0;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") backgrounded = Date.now();
      if (
        state === "active" &&
        backgrounded &&
        Date.now() - backgrounded >= 30_000 &&
        user &&
        role === "SELLER" &&
        !security
      ) {
        setSecurity("unlock");
        backgrounded = 0;
      }
    });
    return () => sub.remove();
  }, [user, role, security]);
  const signOut = async () => {
    setAuthIntent("LOGIN");
    // Start revocation with the current token, then clear local access immediately.
    const revoke = api("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setRole("BUYER");
    roleIntent.current = null;
    recoverAccount.current = null;
    setSecurity(null);
    setFeedback(null);
    reset("language");
    await clearSession();
    void revoke;
  };
  return (
    <LocaleProvider value={locale}>
      <Context.Provider
        value={{
          route,
          canGoBack: backStack(stack, !!user) !== stack,
          openLanguage: (introStep?: number) => setStack((v) => openLanguageScreen(v, introStep)),
          finishLanguage: () => setStack(finishLanguageSelection),
          go,
          returnTo: (name: Route["name"], id?: string, query?: string) =>
            setStack((current) => returnToScreen(current, { name, id, query })),
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
          selectRole,
          authIntent,
          startRegistration: (phone: string) => {
            recoverAccount.current = null;
            roleIntent.current = null;
            setAuthIntent("REGISTER");
            setStack([{ name: "role", id: phone, query: "register" }]);
          },
          startLogin: () => {
            roleIntent.current = null;
            setAuthIntent("LOGIN");
            reset("phone");
          },
          finishSignIn,
          security,
          unlock: () => setSecurity(null),
          recoverSecurity: async () => {
            if (!user || role !== "SELLER") return;
            const account = user;
            const version = sessionVersion();
            // Keep the PIN gate and session intact if sending the code fails.
            await api("/auth/otp/request", {
              method: "POST",
              body: { phone: account.phoneE164, deviceId: await deviceId() },
            });
            if (sessionVersion() !== version) return;
            const revoke = api("/auth/logout", { method: "POST" }).catch(() => {});
            await clearSession();
            setAuthIntent("LOGIN");
            recoverAccount.current = account.id;
            roleIntent.current = null;
            setUser(null);
            setRole("SELLER");
            // Keep the account locked when OTP loads it, until finishSignIn
            // establishes the new PIN setup after verified ownership.
            setSecurity("unlock");
            setFeedback(null);
            setStack([
              { name: "phone", id: account.phoneE164 },
              { name: "otp", id: account.phoneE164 },
            ]);
            void revoke;
          },
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
    go: (name: Route["name"], id?: string, query?: string) => void;
    returnTo: (name: Route["name"], id?: string, query?: string) => void;
    back: () => void;
    reset: (name: Route["name"]) => void;
    locale: Locale;
    changeLocale: (l: Locale) => Promise<void>;
    user: Customer | null;
    setUser: (u: Customer | null) => void;
    loadUser: (publish?: boolean) => Promise<Customer>;
    ready: boolean;
    authIntent: "LOGIN" | "REGISTER";
    startLogin: () => void;
    startRegistration: (phone: string) => void;
    role: "BUYER" | "SELLER";
    setRole: (r: "BUYER" | "SELLER") => void;
    signOut: () => Promise<void>;
    selectRole: (role: "BUYER" | "SELLER") => Promise<void>;
    finishSignIn: (user: Customer) => Promise<void>;
    security: "create" | "unlock" | null;
    unlock: () => void;
    recoverSecurity: () => Promise<void>;
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
export function useResource<T>(path: string, enabled = true) {
  const { locale } = useApp();
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const current = ++request.current;
    if (!enabled) {
      setData(null);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api<T>(path);
      if (request.current === current) setData(result);
    } catch (e) {
      if (request.current === current) setError(localizedError(locale, e));
    } finally {
      if (request.current === current) setLoading(false);
    }
  }, [path, locale, enabled]);
  useEffect(() => {
    void reload();
    return () => {
      request.current++;
    };
  }, [reload]);
  return { data, error, loading, reload };
}
