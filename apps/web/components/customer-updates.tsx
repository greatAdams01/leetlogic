"use client";
import {
  notificationKind,
  notificationDay,
} from "../../../packages/contracts/src/notification-presentation";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { customerApi } from "../lib/customer-api";
import { CustomerRecovery } from "./customer-recovery";
import { orderUpdateCopy } from "../../../packages/contracts/src/order-updates";
import { useLanguage } from "./language-provider";
import { ui, localizedError } from "../../mobile/src/lib/localization";
export function CustomerUpdates() {
  const { locale } = useLanguage();
  const [seller, setSeller] = useState(false),
    [data, setData] = useState<any>(null),
    [filter, setFilter] = useState("All"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () => {
      if (document.visibilityState !== "hidden")
        void customerApi("me")
          .then(async (profile) => {
            const isSeller = !!profile.user.capabilities?.some(
              (c: any) => c.capability === "SELLER",
            );
            const d = await customerApi(
              `orders/notifications?view=${isSeller ? "seller" : "buyer"}`,
            );
            if (active) {
              setSeller(isSeller);
              setData(d);
              setError("");
            }
          })
          .catch((e) => {
            if (active) setError(localizedError(locale, e));
          });
    };
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [locale]);
  const items = (data?.items || []).filter(
    (i: any) =>
      filter === "All" ||
      (filter === "Unread" ? !i.readAt : notificationKind(i.messageKey, i.listingId) === filter),
  );
  return (
    <section className="customer-panel notifications-screen">
      <Link href="/account">← {ui(locale, "Account")}</Link>
      <h1>{ui(locale, "Notifications")}</h1>
      <p>
        {ui(locale, "Order and account notifications")} · {data?.unreadCount || 0}{" "}
        {ui(locale, "Unread")}
      </p>
      <CustomerRecovery />
      <nav
        aria-label={ui(locale, "Notifications")}
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBlock: 24 }}
      >
        {["All", "Unread", "Orders", "Payments", "Delivery", "Pickup", "System"].map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {ui(locale, f)}
          </button>
        ))}
      </nav>
      {!!data?.unreadCount && (
        <button
          disabled={busy}
          aria-busy={busy}
          onClick={() => {
            setBusy(true);
            void customerApi("orders/notifications/read", { through: data.readThrough })
              .then(() =>
                setData({
                  ...data,
                  unreadCount: 0,
                  items: data.items.map((i: any) => ({
                    ...i,
                    readAt: i.readAt || new Date().toISOString(),
                  })),
                }),
              )
              .catch((e) => setError(localizedError(locale, e)))
              .finally(() => setBusy(false));
          }}
        >
          {ui(locale, "Mark all as read")}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">{ui(locale, "Loading…")}</p>}
      {data && !items.length && <p>{ui(locale, "No notifications match this filter.")}</p>}
      {items.map((i: any, index: number) => {
        const copy = orderUpdateCopy(i.messageKey, !seller);
        const kind = notificationKind(i.messageKey, i.listingId);
        const icon = {
          Orders: "packing",
          Payments: "payment",
          Delivery: "delivery",
          Pickup: "pickup",
          System: "notification",
        }[kind];
        return (
          <Fragment key={i.id}>
            {(index === 0 ||
              notificationDay(items[index - 1].createdAt) !== notificationDay(i.createdAt)) && (
              <h2 className="notification-day">{ui(locale, notificationDay(i.createdAt))}</h2>
            )}
            <article
              key={i.id}
              style={{
                padding: 20,
                marginBlock: 12,
                border: "1px solid #dce5df",
                borderLeft: `4px solid ${i.readAt ? "#dce5df" : "#155c36"}`,
                borderRadius: 12,
                background: i.readAt ? "#fff" : "#f2faf5",
              }}
            >
              <div className="notification-kind">
                <img
                  src={`/order-icons/${icon}.svg`}
                  width={kind === "Orders" ? 20 : 22}
                  height={kind === "Orders" ? 20 : 22}
                  alt=""
                />
                <span>{ui(locale, kind)}</span>
                {!i.readAt && <strong>{ui(locale, "Unread")}</strong>}
              </div>
              <small>
                {i.orderReference
                  ? `${ui(locale, "Order")} ${i.orderReference.slice(-8).toUpperCase()} · `
                  : ""}
                <time dateTime={i.createdAt}>{new Date(i.createdAt).toLocaleString(locale)}</time>
              </small>
              <h2 style={{ fontSize: 18, marginBlock: 8 }}>{ui(locale, copy.title)}</h2>
              {i.produceTitle && <strong>{i.produceTitle}</strong>}
              <p>{ui(locale, copy.body)}</p>
              {(i.orderId || i.listingId) && (
                <Link
                  href={
                    i.listingId
                      ? `/produce/${i.listingId}`
                      : `/orders/${i.orderId}${/RECOVERY|REFUND/.test(i.messageKey) ? "#order-assistance" : ""}`
                  }
                  onClick={() => {
                    if (!i.readAt)
                      void customerApi("orders/notifications/read", { ids: [i.id] }).catch(
                        () => {},
                      );
                  }}
                >
                  {ui(locale, i.listingId ? "View listing" : "View order")} →
                </Link>
              )}
            </article>
          </Fragment>
        );
      })}
    </section>
  );
}
