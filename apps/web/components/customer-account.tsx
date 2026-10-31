"use client";
import { useEffect, useRef, useState } from "react";
import {ui, localizedError} from "../../mobile/src/lib/localization";
import { needsSignIn, profileFailureCode } from "../../mobile/src/lib/auth-errors";
import Link from "next/link";
import { customerApi } from "../lib/customer-api";
import { useLanguage } from "./language-provider";
import { CustomerAddresses } from "./customer-addresses";
export function CustomerAccount() {
  const { t, setLocale, locale } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [intent, setIntent] = useState<"LOGIN" | "REGISTER">("LOGIN");
  const [role, setRole] = useState<"BUYER" | "SELLER">("BUYER");
  const [sent, setSent] = useState(false);
  const [errorCode, setErrorCode] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [profilePending, setProfilePending] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const loadVersion = useRef(0);
  const submitting = useRef(false);
  const load = async () => {
    const version = ++loadVersion.current;
    setCheckingProfile(true);
    let data;
    try {
      data = await customerApi("me");
    } catch (error) {
      if (loadVersion.current !== version) return;
      if (needsSignIn(error)) {
        setUser(null);
        setProfilePending(false);
        setSent(false);
        setCode("");
        setOrders([]);
        setNotifications([]);
        setErrorCode("");
        setNotice("");
      } else {
        setProfilePending(true);
        const failureCode = profileFailureCode(error);
        if (failureCode === "ACCOUNT_ROLE_CONFLICT") {
          setUser(null);
          setOrders([]);
          setNotifications([]);
        }
        setErrorCode(failureCode);
        setNotice(localizedError(locale, { code: failureCode }));
      }
      setCheckingProfile(false);
      return;
    }
    if (loadVersion.current !== version) return;
    setUser(data.user);
    setProfilePending(false);
    setCheckingProfile(false);
    setSent(false);
    setCode("");
    setErrorCode("");
    setNotice("");
    try {
      const orders = await customerApi(`orders?view=${data.user.capabilities?.some((entry: any) => entry.capability === "SELLER") ? "seller" : "buyer"}`);
      if (loadVersion.current !== version) return;
      setOrders(orders.items);
      const inbox = await customerApi("orders/notifications");
      if (loadVersion.current === version) setNotifications(inbox.items);
    } catch (error) {
      // Orders/inbox outages must not turn a successful profile read into a failed login.
      if (loadVersion.current !== version) return;
      const roleConflict = profileFailureCode(error) === "ACCOUNT_ROLE_CONFLICT";
      if (needsSignIn(error) || roleConflict) {
        setUser(null);
        setOrders([]);
        setNotifications([]);
        setProfilePending(roleConflict);
        setSent(false);
        setCode("");
      }
      setErrorCode((error as { code?: string })?.code || "REQUEST_FAILED");
      setNotice(localizedError(locale, error));
    }
  };
  useEffect(() => {
    void load();
    return () => { loadVersion.current++; };
  }, []);
  async function retryProfile() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setNotice("");
    setErrorCode("");
    try { await load(); } finally { submitting.current = false; setBusy(false); }
  }
  async function signOut() {
    if (submitting.current) return;
    submitting.current = true;
    loadVersion.current++;
    setBusy(true);
    try { await customerApi("auth/logout", {}); } catch { /* The proxy clears local cookies even during an outage. */ }
    finally {
      setUser(null);
      setOrders([]);
      setNotifications([]);
      setProfilePending(false);
      setCheckingProfile(false);
      setSent(false);
      setCode("");
      setNotice("");
      setErrorCode("");
      submitting.current = false;
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current || checkingProfile) return;
    submitting.current = true;
    setBusy(true);
    setNotice("");
    setErrorCode("");
    try {
      if (!sent) {
        await customerApi("auth/otp/request", { phone, intent, ...(intent === "REGISTER" ? { role } : {}) });
        setSent(true);
        setNotice(t("auth.sent"));
      } else {
        const data = await customerApi("auth/otp/verify", { phone, code, intent, ...(intent === "REGISTER" ? { role } : {}) });
        setLocale(data.user.preferredLocale);
        setCode("");
        setProfilePending(true);
        await load();
      }
    } catch (e) {
      const failure = e as { code?: string };
      setErrorCode(failure?.code || "");
      setNotice(localizedError(locale, e));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function resendCode() {
    if (submitting.current || profilePending) return;
    submitting.current = true;
    setBusy(true);
    setNotice("");
    setErrorCode("");
    try {
      await customerApi("auth/otp/request", { phone, intent, ...(intent === "REGISTER" ? { role } : {}) });
      setCode("");
      setSent(true);
      setNotice(t("auth.sent"));
    } catch (error) {
      setErrorCode((error as { code?: string })?.code || "");
      setNotice(localizedError(locale, error));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="customer-panel">
      <h1>{user ? (user.capabilities?.some((entry: any) => entry.capability === "SELLER") ? "Seller Dashboard" : "Buyer Dashboard") : t("auth.title")}</h1>
      {!user && checkingProfile && <p role="status">{ui(locale, "Loading your account…")}</p>}
      {profilePending && !checkingProfile && <div>
        <button type="button" disabled={busy} onClick={() => void retryProfile()}>{t("common.retry")}</button>
        {!user && <button type="button" disabled={busy} onClick={() => void signOut()}>{t("common.cancel")}</button>}
      </div>}
      {!user ? (
        !profilePending && !checkingProfile &&
        <form onSubmit={submit}>
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" disabled={busy} aria-pressed={intent === "LOGIN"} onClick={() => { setIntent("LOGIN"); setSent(false); setCode(""); setNotice(""); }}>Log In</button>
            <button type="button" disabled={busy} aria-pressed={intent === "REGISTER"} onClick={() => { setIntent("REGISTER"); setSent(false); setCode(""); setNotice(""); }}>Create Account</button>
          </div>
          {intent === "REGISTER" && !sent && <label>Account type
            <select value={role} onChange={(e) => setRole(e.target.value as "BUYER" | "SELLER")}>
              <option value="BUYER">Buyer</option><option value="SELLER">Seller / Farmer</option>
            </select>
          </label>}

          <label>
            {t("auth.phone")}
            <input
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setErrorCode(""); setNotice(""); }}
              disabled={sent || busy}
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
                disabled={busy}
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
              disabled={busy}
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
            disabled={busy}
            onClick={() => void signOut()}
          >
            {t("auth.signout")}
          </button>
          {user.capabilities?.some((entry: any) => entry.capability === "SELLER") && <p>
            <Link href="/sell">{t("nav.sell")}</Link>
          </p>}
          <CustomerAddresses addresses={user.addresses || []} seller={user.capabilities?.some((entry: any) => entry.capability === "SELLER")} onSaved={async () => { await load(); }} />
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
      {["OTP_EXPIRED", "OTP_ATTEMPTS_EXCEEDED"].includes(errorCode) && <button type="button" disabled={busy} onClick={() => void resendCode()}>{ui(locale, "Resend code")}</button>}
      {errorCode === "ACCOUNT_NOT_FOUND" && <h2>{ui(locale, "No account found")}</h2>}
      <p role={errorCode ? "alert" : "status"}>{notice}</p>
      {errorCode === "ACCOUNT_NOT_FOUND" && <button type="button" onClick={() => { setIntent("REGISTER"); setSent(false); setCode(""); setNotice(""); setErrorCode(""); }}>{ui(locale, "Create Account")}</button>}
      {errorCode === "PHONE_ALREADY_REGISTERED" && <button type="button" onClick={() => { setIntent("LOGIN"); setSent(false); setCode(""); setNotice(""); setErrorCode(""); }}>{ui(locale, "Log In")}</button>}
    </section>
  );
}
