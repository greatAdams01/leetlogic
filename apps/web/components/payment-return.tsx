"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { customerApi } from "../lib/customer-api";
import { useLanguage } from "./language-provider";
import { ui, localizedStatus, localizedError } from "../../mobile/src/lib/localization";
export function PaymentReturn() {
  const { locale } = useLanguage();
  const [payment, setPayment] = useState<any>(null),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("attempt");
    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return;
    let active = true, running = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      if (!active || running) return;
      running = true;
      let retry = true;
      try {
        const p = await customerApi(`financial/payments/${id}`);
        if (!active) return;
        setPayment(p);
        const updated = p.paymentConfirmed ? p : await customerApi(`orders/${p.orderId}/payments/${p.id}/refresh`, {});
        if (!active) return;
        setPayment(updated);
        retry = !updated.paymentConfirmed && !["EXCEPTION", "REFUNDED"].includes(updated.status);
        setNotice(retry ? ui(locale, "Confirming your payment. Please don’t pay again.") : "");
      } catch (e) {
        if (active) setNotice(localizedError(locale, e));
      } finally {
        running = false;
        if (active && retry) timer = setTimeout(() => void check(), 30000);
      }
    };
    void check();
    return () => { active = false; clearTimeout(timer); };
  }, [locale]);
  return (
    <section className="customer-panel">
      <h1>{ui(locale, "Check payment status")}</h1>
      <p>
        {ui(
          locale,
          "Return to your order to check your payment. You can also return to the LeetLogic app.",
        )}
      </p>
      {payment && (
        <>
          <p>{localizedStatus(locale, payment.status)}</p>
          <Link href={`/orders/${payment.orderId}`}>{ui(locale, "View order")}</Link>
        </>
      )}
      <Link href="/account">{ui(locale, "My account")}</Link>
      <Link href="/account/payments">{ui(locale, "Payments and earnings")}</Link>
      <p role="status">{notice}</p>
    </section>
  );
}
