"use client";
import { useEffect, useState } from "react";
import {ui} from "../../mobile/src/lib/localization";
import Link from "next/link";
import { customerApi } from "../lib/customer-api";
import { useLanguage } from "./language-provider";
export function CustomerAccount() {
  const { t, setLocale, locale } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () =>
    customerApi("me")
      .then((data) => {
        setUser(data.user);
        return customerApi("orders");
      })
      .then(async (data) => {
        setOrders(data.items);
        const inbox = await customerApi("orders/notifications");
        setNotifications(inbox.items);
      })
      .catch(() => setUser(null));
  useEffect(() => {
    void load();
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      if (!sent) {
        await customerApi("auth/otp/request", { phone });
        setSent(true);
        setNotice(t("auth.sent"));
      } else {
        const data = await customerApi("auth/otp/verify", { phone, code });
        setLocale(data.user.preferredLocale);
        await load();
      }
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="customer-panel">
      <h1>{t("auth.title")}</h1>
      {!user ? (
        <form onSubmit={submit}>
          <label>
            {t("auth.phone")}
            <input
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={sent}
              placeholder="+234…"
            />
          </label>
          {sent && (
            <label>
              {t("auth.code")}
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
          )}
          <button disabled={busy}>
            {busy ? t("common.loading") : t(sent ? "auth.verify" : "auth.send")}
          </button>
          {sent && (
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setCode("");
              }}
            >
              {t("common.cancel")}
            </button>
          )}
        </form>
      ) : (
        <>
          <p>{user.phoneE164}</p>
          <p>
            <Link href="/account/payments">{ui(locale,"Payments and earnings")}</Link>
          </p>
          <button
            onClick={async () => {
              await customerApi("auth/logout", {});
              setUser(null);
            }}
          >
            {t("auth.signout")}
          </button>
          <p>
            <Link href="/sell">{t("nav.sell")}</Link>
          </p>
          <h2>{t("delivery.title")}</h2>
          {notifications.map((n) => (
            <p key={n.id}>
              <Link href={`/orders/${n.orderId}`}>{t(n.messageKey) || n.messageKey}</Link>
            </p>
          ))}
          <h2>{t("orders.title")}</h2>
          {orders.length ? (
            orders.map((order) => (
              <article key={order.id}>
                <Link href={`/orders/${order.id}`}>
                  {order.reference} — {order.listing.title}
                </Link>
                <p>
                  {order.delivery
                    ? t(`status.${order.delivery.status}` as any) || order.delivery.status
                    : order.status}
                </p>
              </article>
            ))
          ) : (
            <p>{t("orders.empty")}</p>
          )}
        </>
      )}
      <p role="status">{notice}</p>
    </section>
  );
}
