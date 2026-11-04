"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { customerApi } from "../lib/customer-api";
import { useLanguage } from "./language-provider";
import { ui, localizedError } from "../../mobile/src/lib/localization";
import { recoveryExperience } from "../../../packages/contracts/src/order-updates";
import { formatMoney as money } from "../../../packages/contracts/src/money";
export function CustomerRecovery({ orderId }: { orderId?: string }) {
  const { locale } = useLanguage(),
    [items, setItems] = useState<any[]>([]),
    [error, setError] = useState("");
  const version = useRef(0);
  const load = useCallback(async () => {
    const v = ++version.current,
      data = await customerApi("orders/recoveries");
    if (v === version.current)
      setItems((data.items || []).filter((r: any) => !orderId || r.orderId === orderId));
  }, [orderId]);
  useEffect(() => {
    let active = true;
    const read = () => {
      if (document.visibilityState === "hidden") return;
      void load().catch((e) => {
        if (active) setError(localizedError(locale, e));
      });
    };
    read();
    const timer = setInterval(read, 15000);
    return () => {
      active = false;
      version.current++;
      clearInterval(timer);
    };
  }, [load, locale]);
  return (
    <section id="order-assistance" aria-label={ui(locale, "Order assistance")}>
      {items.slice(0, orderId ? 50 : 3).map((r) => (
        <RecoveryCard key={r.id} record={r} compact={!orderId} refresh={load} />
      ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
function RecoveryCard({
  record: r,
  compact,
  refresh,
}: {
  record: any;
  compact: boolean;
  refresh: () => Promise<void>;
}) {
  const { locale } = useLanguage(),
    say = (s: string) => ui(locale, s),
    x = recoveryExperience(r),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [minutes, setMinutes] = useState("60"),
    [notes, setNotes] = useState(""),
    [choice, setChoice] = useState(
      r.proposal?.quoteId || r.proposal?.snapshot?.options?.[0]?.id || "",
    );
  const lock = useRef(false),
    p = r.proposal,
    s = p?.snapshot,
    q = s?.options?.find((q: any) => q.id === choice),
    delta = q ? BigInt(q.shippingMinor) - BigInt(s.originalShippingMinor) : 0n;
  const act = async (path: string, body: any) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await customerApi(`orders/recoveries/${r.id}/${path}`, body);
      setNotice(say("Your response has been saved."));
      await refresh();
    } catch (e) {
      setError(localizedError(locale, e));
      await refresh().catch(() => {});
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <article className="customer-panel">
      <h3>{say(x.title)}</h3>
      <strong>{r.title}</strong>
      <p>
        {say("Order")}: {String(r.reference).slice(-8).toUpperCase()}
      </p>
      <p>{say(x.body)}</p>
      {!x.closed && r.deadline?.refundDueAt && (
        <p>
          {say("Respond before")}: {new Date(r.deadline.refundDueAt).toLocaleString()}
        </p>
      )}
      {compact ? (
        <Link href={`/orders/${r.orderId}#order-assistance`}>{say("Review order issue")}</Link>
      ) : (
        <>
          <p>
            {say("Quantity")}: {r.quantity} {r.unitCode}
          </p>
          {r.packing && (
            <p>
              {say("Number of packages")}: {r.packing.packageCount} ·{" "}
              {say("Total packed weight (kg)")}: {r.packing.weightKg}
            </p>
          )}
          {r.isBuyer && (
            <p>
              {say("Payment confirmed")}: {money(r.payment.amountMinor)}
            </p>
          )}
          {!r.isBuyer && r.pickup && (
            <p>
              {say("Pickup location")}: {r.pickup.address}, {r.pickup.state}
            </p>
          )}
          {x.canFarmerConfirm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act("farmer", {
                  pickupDate: date,
                  preparationMinutes: Number(minutes),
                  notes,
                });
              }}
            >
              <p>{say("Confirm the original quantity, packaging and saved pickup location.")}</p>
              <label>
                {say("Pickup date")}
                <input
                  required
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label>
                {say("Preparation time (minutes)")}
                <input
                  required
                  type="number"
                  min="0"
                  max="1440"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </label>
              <label>
                {say("Preparation notes")}
                <textarea
                  maxLength={700}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <button disabled={busy}>{say("Confirm stock and pickup availability")}</button>
            </form>
          )}
          {x.canBuyerAccept && (
            <>
              <p>
                {say("Pickup date")}: {s.pickupDate} · {say("Produce")}: {money(s.produceMinor)}
              </p>
              {!s.collection && (
                <label>
                  {say("Select delivery service")}
                  <select
                    value={choice}
                    disabled={busy}
                    onChange={(e) => setChoice(e.target.value)}
                  >
                    {s.options.map((q: any) => (
                      <option key={q.id} value={q.id}>
                        {q.courier} · {money(q.shippingMinor)} · {q.eta}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {q && (
                <p>
                  {say(
                    delta > 0n
                      ? "Additional delivery payment required"
                      : "Refundable delivery surplus",
                  )}
                  : {money(delta < 0n ? -delta : delta)}
                </p>
              )}
              <button
                disabled={busy || (!s.collection && !choice)}
                onClick={() =>
                  void act("decision", {
                    version: r.version,
                    quoteId: s.collection ? null : choice,
                    accept: true,
                  })
                }
              >
                {say("Accept recovery proposal")}
              </button>
            </>
          )}
          {x.canRequestRefund && (
            <button
              disabled={busy}
              onClick={() =>
                void act("decline", {
                  reason: r.isBuyer
                    ? "Buyer requested a refund instead of recovery"
                    : "Farmer cannot fulfill the original order",
                })
              }
            >
              {say(r.isBuyer ? "Request refund" : "Cannot fulfill this order")}
            </button>
          )}
          {r.isBuyer && x.closed && (
            <>
              <p>
                {say(
                  "Refunds return produce and shipping. Processing fees may be non-returnable; bank credit can take longer.",
                )}
              </p>
              <Link href="/account/payments">{say("Payments and earnings")}</Link>
            </>
          )}
          {r.support ? (
            <div>
              <p>
                {say("Support request")}: {r.support.status}
              </p>
              {r.support.reply && <p>{r.support.reply}</p>}
            </div>
          ) : (
            <button
              disabled={busy}
              onClick={() =>
                void act("support", {
                  message: r.isBuyer
                    ? "Please help me resolve this paid order or refund."
                    : "Please help me understand the next action for this order.",
                  sourceLocale: "en",
                })
              }
            >
              {say("Ask staff for help")}
            </button>
          )}
          <p>
            <Link href={`/orders/${r.orderId}`}>{say("View order & tracking")}</Link> ·{" "}
            <Link href="/account">{say("Help and support")}</Link>
          </p>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
