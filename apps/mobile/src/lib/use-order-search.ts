import { AppState } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { Order } from "./domain";
import { useApp } from "../state";
type OrderPage = { items: Order[]; nextCursor?: string | null };
export function useOrderSearch(view: "buyer" | "seller") {
  const a = useApp(),
    errorCopy = useRef(a.error);
  errorCopy.current = a.error;
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [query, setQuery] = useState("");
  const [items, setItems] = useState<Order[]>([]),
    [nextCursor, setNext] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [loadingMore, setLoadingMore] = useState(false),
    [error, setError] = useState("");
  const contextKey = `${a.user?.id || "guest"}:${view}:${filter}:${query}`;
  const [resultContext, setResultContext] = useState(contextKey);
  const version = useRef(0),
    busy = useRef(false);
  const key = `/orders?view=${view}&limit=20&filter=${filter}&q=${encodeURIComponent(query)}`;
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const fetchPage = useCallback(
    async (cursor?: string) => {
      if (cursor && busy.current) return;
      const request = ++version.current;
      busy.current = true;
      if (cursor) setLoadingMore(true);
      else {
        setLoading(true);
        setResultContext(contextKey);
        setItems([]);
        setNext(null);
      }
      setError("");
      try {
        const page = await api<OrderPage>(
          `${key}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        );
        if (request !== version.current) return;
        setItems((previous) =>
          cursor
            ? [...previous, ...page.items.filter((item) => !previous.some((p) => p.id === item.id))]
            : page.items,
        );
        setNext(page.nextCursor || null);
      } catch (e) {
        if (request === version.current) setError(errorCopy.current(e));
      } finally {
        if (request === version.current) {
          busy.current = false;
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [key, contextKey],
  );
  useEffect(() => {
    void fetchPage();
    return () => {
      version.current++;
      busy.current = false;
    };
  }, [fetchPage]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && !busy.current) void fetchPage();
    });
    return () => sub.remove();
  }, [fetchPage]);
  return {
    search,
    setSearch,
    filter,
    setFilter,
    data: { items: resultContext === contextKey ? items : [] },
    loading: loading || search.trim() !== query || resultContext !== contextKey,
    loadingMore,
    error,
    nextCursor,
    reload: () => fetchPage(),
    loadMore: () => (nextCursor ? fetchPage(nextCursor) : Promise.resolve()),
  };
}
