"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { customerApi } from "../lib/customer-api";
import { useLanguage } from "./language-provider";
import { ui, localizedError, localizedStatus } from "../../mobile/src/lib/localization";
import { formatMoney } from "../../../packages/contracts/src/money";
import type { Order } from "../../mobile/src/lib/domain";
export function CustomerOrders() {
  const { locale } = useLanguage(),
    say = (s: string) => ui(locale, s);
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("ALL");
  const [items, setItems] = useState<Order[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [more, setMore] = useState(false),
    [error, setError] = useState("");
  const version = useRef(0),
    running = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const load = useCallback(
    async (next?: string) => {
      if (next && running.current) return;
      const request = ++version.current;
      running.current = true;
      setError("");
      if (next) setMore(true);
      else {
        setLoading(true);
        setItems([]);
        setCursor(null);
      }
      try {
        const page = await customerApi(
          `orders?view=buyer&limit=20&filter=${filter}&q=${encodeURIComponent(query)}${next ? `&cursor=${encodeURIComponent(next)}` : ""}`,
        );
        if (request !== version.current) return;
        setItems((previous) =>
          next
            ? [
                ...previous,
                ...page.items.filter((item: Order) => !previous.some((p) => p.id === item.id)),
              ]
            : page.items,
        );
        setCursor(page.nextCursor || null);
      } catch (e) {
        if (request === version.current) setError(localizedError(locale, e));
      } finally {
        if (request === version.current) {
          running.current = false;
          setLoading(false);
          setMore(false);
        }
      }
    },
    [query, filter, locale],
  );
  useEffect(() => {
    void load();
    return () => {
      version.current++;
      running.current = false;
    };
  }, [load]);
  useEffect(() => {
    const focus = () => {
      if (!running.current) void load();
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [load]);
  const searching = loading || search.trim() !== query;
  return (
    <section className="buyer-orders" aria-labelledby="buyer-orders-heading">
      <h2 id="buyer-orders-heading">{say("Your orders")}</h2>
      <label className="order-search-label">
        {say("Search orders")}
        <input
          type="search"
          maxLength={100}
          placeholder={say("Order number, produce or farmer")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <nav aria-label={say("Filter orders")}>
        {(
          [
            ["ALL", "All Orders"],
            ["ACTIVE", "Active"],
            ["COMPLETED", "Completed"],
            ["CANCELLED", "Cancelled"],
          ] as const
        ).map(([value, label]) => (
          <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
            {say(label)}
          </button>
        ))}
      </nav>
      {error && <p role="alert">{error}</p>}
      {searching ? (
        <p role="status">{say("Loading orders…")}</p>
      ) : !items.length ? (
        <p role="status">{say("No orders match your search and filters.")}</p>
      ) : (
        items.map((order) => (
          <article key={order.id}>
            <Link href={`/orders/${order.id}`}>
              <strong>{order.listing.title}</strong>
            </Link>
            <p>
              {order.reference} ·{" "}
              {order.status === "AWAITING_PAYMENT"
                ? say("Checkout in progress")
                : order.fulfillmentStatus && order.fulfillmentStatus !== order.status
                  ? say(order.fulfillmentStatus)
                  : localizedStatus(locale, order.status)}
            </p>
            <p>
              {order.sellerName}
              {order.farmName && order.farmName !== order.sellerName ? ` · ${order.farmName}` : ""}
            </p>
            <p>{formatMoney(order.totalMinor)}</p>
            <Link href={`/orders/${order.id}`}>{say("View order")} →</Link>
          </article>
        ))
      )}
      {cursor && !searching && (
        <button disabled={more} onClick={() => void load(cursor)}>
          {say(more ? "Loading…" : "Load more orders")}
        </button>
      )}
      <button disabled={loading || more} onClick={() => void load()}>
        {say("Refresh orders")}
      </button>
      {error && <button onClick={() => void load()}>{say("Try again")}</button>}
    </section>
  );
}
