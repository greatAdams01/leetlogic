"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { TranslatedText } from "./translated-text";
import { customerApi } from "../lib/customer-api";
import { useLanguage } from "./language-provider";
import type { MessageKey } from "../lib/locales/messages";
const money = (minor: string) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    Number(minor) / 100,
  );
export function CustomerDelivery({
  id,
  staff = false,
  staffPermissions = [],
}: {
  id: string;
  staff?: boolean;
  staffPermissions?: string[];
}) {
  const { t } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [stepUpCode, setStepUpCode] = useState("");
  const manage = !staff || staffPermissions.includes("orders.manage");
  const call = async (suffix = "", body?: unknown) => {
    if (!staff) return customerApi(`orders/${id}/delivery${suffix}`, body);
    const response = await fetch(`/api/admin/delivery-orders/${id}/delivery${suffix}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || "Request failed");
    return result;
  };
  const load = async () => setData(await call());
  useEffect(() => {
    load().catch((e) => setNotice(e.message));
  }, [id, staff]);
  async function action(suffix: string, body: unknown) {
    setBusy(true);
    setNotice("");
    try {
      if (staff && ["/payment", "/link", "/cancel"].includes(suffix)) {
        const check = await fetch("/api/admin/auth/totp/step-up", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: stepUpCode }),
        });
        const result = await check.json();
        if (!check.ok)
          throw new Error(result.error?.message || "Authenticator confirmation failed");
        setStepUpCode("");
      }
      const result = await call(suffix, body);
      if (result.message) setNotice(result.message);
      await load();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function quotes(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const contact = (prefix: string) =>
      Object.fromEntries(
        ["name", "email", "phone", "address", "state"].map((key) => [
          key,
          form.get(`${prefix}.${key}`),
        ]),
      );
    await action("/quotes", {
      pickup: contact("pickup"),
      destination: contact("destination"),
      parcel: {
        weightKg: Number(form.get("weight")),
        length: Number(form.get("length")),
        width: Number(form.get("width")),
        height: Number(form.get("height")),
        pickupDate: form.get("date"),
        handling: form.get("handling"),
      },
    });
  }
  if (!data)
    return (
      <section className="customer-panel">
        <h1>{t("delivery.title")}</h1>
        <p role="status">{notice || t("common.loading")}</p>
        <Link href="/account">{t("auth.required")}</Link>
      </section>
    );
  const d = data.delivery;
  return (
    <section className="customer-panel">
      <h1>{data.order.title}</h1>
      <p>{data.order.reference}</p>
      {!staff && data.order.description && (
        <TranslatedText
          resource="listings"
          id={data.order.listingId}
          original={data.order.description}
        />
      )}
      <dl>
        <dt>{t("orders.produce")}</dt>
        <dd>{money(data.order.totalMinor)}</dd>
        <dt>{t("orders.delivery")}</dt>
        <dd>{money(d?.shippingMinor || "0")}</dd>
        <dt>{t("orders.total")}</dt>
        <dd>{money(String(BigInt(data.order.totalMinor) + BigInt(d?.shippingMinor || "0")))}</dd>
      </dl>
      <p>{t("delivery.payment")}</p>
      {d && (
        <>
          <h2>{t(`status.${d.status}` as MessageKey) || d.status}</h2>
          {d.failureCode && <p role="status">{d.failureCode}</p>}
          {d.trackingUrl && (
            <a href={d.trackingUrl} target="_blank" rel="noreferrer">
              {t("delivery.tracking")}
            </a>
          )}
          <ol>
            {d.events.map((event: any) => (
              <li key={event.id}>
                {t(`status.${event.status}` as MessageKey) || event.status} —{" "}
                {new Date(event.createdAt).toLocaleString()}
              </li>
            ))}
          </ol>
        </>
      )}
      <button disabled={busy} onClick={() => load().catch((e) => setNotice(e.message))}>
        {t("delivery.refresh")}
      </button>
      {manage &&
        (staff || data.order.isBuyer) &&
        data.order.status === "AWAITING_PAYMENT" &&
        !d?.paidMinor?.match(/[1-9]/) && (
          <form onSubmit={quotes}>
            {["pickup", "destination"].map((prefix) => (
              <fieldset key={prefix}>
                <legend>{t(`delivery.${prefix}` as MessageKey)}</legend>
                {["name", "email", "phone", "address", "state"].map((key) => (
                  <label key={key}>
                    {t(`delivery.${key}` as MessageKey)}
                    <input
                      name={`${prefix}.${key}`}
                      required
                      type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
                      defaultValue={
                        d?.[prefix]?.[key] ||
                        (prefix === "pickup" ? data.order.suggestedPickup?.[key] : "") ||
                        ""
                      }
                    />
                  </label>
                ))}
              </fieldset>
            ))}
            {["weight", "length", "width", "height"].map((key) => (
              <label key={key}>
                {t(`delivery.${key}` as MessageKey)}
                <input name={key} type="number" step="0.01" min="0.01" required />
              </label>
            ))}
            <label>
              {t("delivery.date")}
              <input name="date" type="date" min={new Date().toISOString().slice(0, 10)} required />
            </label>
            <label>
              {t("delivery.handling")}
              <select name="handling">
                <option value="STANDARD">Standard parcel</option>
                <option value="PERISHABLE">Perishable produce</option>
                <option value="COLD_CHAIN">Cold chain</option>
                <option value="BULK">Bulk load</option>
              </select>
            </label>
            <button disabled={busy}>{t("delivery.quotes")}</button>
          </form>
        )}
      {manage &&
        (staff || data.order.isBuyer) &&
        data.order.status === "AWAITING_PAYMENT" &&
        d?.quotes?.map((quote: any) => (
          <article key={quote.id}>
            <h3>
              {quote.courier} — {money(quote.amountMinor)}
            </h3>
            <p>{quote.eta}</p>
            <button
              disabled={busy || new Date(quote.expiresAt) <= new Date()}
              onClick={() => action("/select", { quoteId: quote.id })}
            >
              {new Date(quote.expiresAt) <= new Date()
                ? t("delivery.expired")
                : t("delivery.select")}
            </button>
          </article>
        ))}
      {manage &&
        (staff || data.order.isBuyer) &&
        d?.selectedQuoteId &&
        !d?.providerShipmentId &&
        !d?.bookingStartedAt && (
          <button disabled={busy} onClick={() => action("/refresh-quote", {})}>
            Refresh selected delivery quote
          </button>
        )}
      {manage && (staff || data.order.isBuyer) && d?.status === "PAID" && (
        <button disabled={busy} onClick={() => action("/book", {})}>
          {t("delivery.book")}
        </button>
      )}
      {!staff &&
        data.order.isBuyer &&
        d?.status === "DELIVERED" &&
        data.order.status === "FUNDED" && (
          <button disabled={busy} onClick={() => action("/confirm", {})}>
            {t("delivery.confirm")}
          </button>
        )}
      {staff && d && (
        <div>
          <h2>Delivery operations</h2>
          {(staffPermissions.includes("payments.manage") ||
            staffPermissions.includes("orders.manage")) && (
            <label>
              Authenticator code for sensitive actions
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                value={stepUpCode}
                onChange={(e) => setStepUpCode(e.target.value)}
              />
            </label>
          )}
          {d.status === "MANUAL_REVIEW" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void action("/manual-dispatch", {
                  carrier: f.get("carrier"),
                  trackingRef: f.get("trackingRef"),
                  reason: f.get("reason"),
                });
              }}
            >
              <label>
                Confirmed carrier
                <input name="carrier" required />
              </label>
              <label>
                Tracking reference
                <input name="trackingRef" required />
              </label>
              <label>
                Dispatch arrangement
                <input name="reason" minLength={10} required />
              </label>
              <button disabled={busy}>Assign manual dispatch</button>
            </form>
          )}
          {!d.providerShipmentId &&
            ["MANUAL_ASSIGNED", "PICKED_UP", "IN_TRANSIT", "FAILED_ATTEMPT", "RETURNING"].includes(
              d.status,
            ) && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void action("/manual-status", {
                    status: f.get("status"),
                    evidence: f.get("evidence"),
                  });
                }}
              >
                <label>
                  Shipment status
                  <select name="status">
                    {[
                      "PICKED_UP",
                      "IN_TRANSIT",
                      "DELIVERED",
                      "FAILED_ATTEMPT",
                      "RETURNING",
                      "RETURNED",
                      "CANCELLED",
                    ].map((status) => (
                      <option key={status} value={status}>
                        {t(`status.${status}` as MessageKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Dispatch evidence
                  <input name="evidence" required minLength={10} />
                </label>
                <button disabled={busy}>Update manual shipment</button>
              </form>
            )}
          <button disabled={busy} onClick={() => action("/reconcile", {})}>
            Reconcile provider tracking
          </button>
          {d.status === "BOOKING_UNCERTAIN" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void action("/link", {
                  providerShipmentId: f.get("providerShipmentId"),
                  reason: f.get("reason"),
                });
              }}
            >
              <label>
                Verified provider shipment ID
                <input name="providerShipmentId" required />
              </label>
              <label>
                Matching evidence and reason
                <input name="reason" minLength={10} required />
              </label>
              <button disabled={busy}>Link existing shipment</button>
            </form>
          )}
          {staffPermissions.includes("payments.manage") &&
            ["PAYMENT_PENDING", "PAID"].includes(d.status) && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void action("/payment", {
                    amountMinor: d.shippingMinor,
                    reference: f.get("reference"),
                  });
                }}
              >
                <label>
                  Verified external delivery payment reference
                  <input name="reference" required minLength={3} />
                </label>
                <button disabled={busy}>Confirm delivery payment</button>
              </form>
            )}
          {d.providerShipmentId && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void action("/cancel", { reason: f.get("reason") });
              }}
            >
              <label>
                Cancellation reason
                <input name="reason" required minLength={10} />
              </label>
              <button disabled={busy}>Request cancellation</button>
            </form>
          )}
        </div>
      )}
      <p role="status">{notice}</p>
    </section>
  );
}
