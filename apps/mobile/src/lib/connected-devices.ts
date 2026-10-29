import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { api, sessionVersion } from "./api";
import { localizedError } from "./localization";
import type { Locale } from "../../../../packages/localization/src/customer-messages";

export type ConnectedDevice = {
  id: string;
  current: boolean;
  deviceName: string | null;
  platform: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};
export function useConnectedDevices(accountId: string, locale: Locale = "en") {
  const [data, setData] = useState<{ accountId: string; items: ConnectedDevice[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef(0);
  const mounted = useRef(false);
  const identity = useRef(accountId);
  identity.current = accountId;
  const reload = useCallback(async () => {
    if (!mounted.current) return;
    const current = ++request.current;
    const version = sessionVersion();
    const active = () =>
      mounted.current &&
      identity.current === accountId &&
      request.current === current &&
      sessionVersion() === version;
    setLoading(true);
    setData(null);
    setError("");
    try {
      const response = await api<{ items: ConnectedDevice[] }>("/auth/sessions");
      if (!Array.isArray(response?.items))
        throw new Error("We couldn’t load your connected devices. Please try again.");
      if (active()) setData({ accountId, items: response.items });
    } catch (e) {
      if (active()) {
        setData(null);
        setError(localizedError(locale, e));
      }
    } finally {
      if (active()) setLoading(false);
    }
  }, [accountId, locale]);
  useEffect(() => {
    mounted.current = true;
    void reload();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void reload();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void reload();
    }, 30000);
    return () => {
      mounted.current = false;
      ++request.current;
      listener.remove();
      clearInterval(timer);
    };
  }, [reload]);
  return { data: data?.accountId === accountId ? data : null, loading, error, reload };
}
