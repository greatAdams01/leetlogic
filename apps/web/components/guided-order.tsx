"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { orderJourney } from "../../../packages/contracts/src/order-journey";
import { orderUpdateCopy } from "../../../packages/contracts/src/order-updates";
import { formatMoney } from "../../../packages/contracts/src/money";
import { saleUnitLabel } from "../../../packages/contracts/src/sale-packaging";
import { customerApi } from "../lib/customer-api";
import { useLanguage } from "./language-provider";
import { ui, localizedError } from "../../mobile/src/lib/localization";
import { CustomerPayment } from "./customer-payments";
import { CustomerRecovery } from "./customer-recovery";
import { CustomerOrderIssues } from "./customer-order-issues";
export function GuidedOrder({
  data,
  notice,
  onRefresh,
}: {
  data: any;
  notice: string;
  onRefresh: () => Promise<void>;
}) {
  const { locale } = useLanguage(),
    say = (text: string) => ui(locale, text);
  const o = data.order,
    d = data.delivery,
    buyer = o.isBuyer;
  const guide = orderJourney({
    buyer,
    progress: data.progress,
    orderStatus: o.status,
    decision: o.farmerDecision,
    handedOver: !!o.handedOverAt,
    money: data.money,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [reject, setReject] = useState(false),
    [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [ack, setAck] = useState(false),
    [handoff, setHandoff] = useState(false);
  const running = useRef(false),
    confirmationRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (confirm) confirmationRef.current?.showModal();
    else confirmationRef.current?.close();
  }, [confirm]);
  const run = async (path: string, body: unknown = {}) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await customerApi(`orders/${o.id}/delivery/${path}`, body);
      setReject(false);
      setHandoff(false);
      await onRefresh();
    } catch (e) {
      setError(localizedError(locale, e));
      await onRefresh().catch(() => {});
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const submitReceipt = async () => {
    if (running.current || !file || !ack) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/customer/orders/${o.id}/delivery/receipt-photo`, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const result = await response.json();
      if (!response.ok)
        throw Object.assign(new Error(result.error?.message || "Photo upload failed"), {
          code: result.error?.code,
        });
      await customerApi(`orders/${o.id}/delivery/confirm`, { acknowledged: true });
      setConfirm(false);
      setFile(null);
      setAck(false);
      await onRefresh();
    } catch (e) {
      setError(localizedError(locale, e));
      await onRefresh().catch(() => {});
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const act = () => {
    if (guide.action === "confirm") setConfirm(true);
    else if (guide.action === "accept") void run("decision", { accept: true });
    else if (guide.action === "ready") void run("ready");
    else setHandoff(true);
  };
  const icon = (name: string) => (
    <img
      src={`/order-icons/${name}.svg`}
      alt=""
      width={name === "packing" ? 20 : 22}
      height={name === "packing" ? 20 : 22}
    />
  );
  return (
    <section className="customer-panel order-journey">
      <header className="journey-header">
        <Link href="/account">← {say("Orders")}</Link>
        <span>#{o.reference.slice(-8).toUpperCase()}</span>
      </header>
      <section className="journey-status" aria-live="polite">
        <div className="journey-emblem">
          {icon(
            guide.action === "accept" ? "notification" : guide.stage === 1 ? "packing" : "delivery",
          )}
        </div>
        <p className="journey-eyebrow">{say(buyer ? "YOUR ORDER" : "FARMER ORDER")}</p>
        <h1>{say(guide.title)}</h1>
        <p>{say(guide.body)}</p>
      </section>
      {(error || notice) && (
        <p className="journey-feedback" role="alert">
          {error || notice}
        </p>
      )}
      {o.checkoutErrorCode === "ORDER_EXPIRED" && o.listingId && (
        <section className="journey-card">
          <p>{say("This reservation has expired.")}</p>
          <Link href={`/produce/${o.listingId}`}>{say("View produce")}</Link>
        </section>
      )}
      <section className="journey-card">
        <h2>{o.title}</h2>
        <p>
          {o.quantity || 1} {saleUnitLabel(o.salePackaging, say) || o.unitCode}
        </p>
        <div className="journey-row">
          <span>{say("Produce total")}</span>
          <strong className="journey-price">{formatMoney(o.totalMinor)}</strong>
        </div>
        <div className="journey-row">
          {icon(data.progress?.method === "Pickup" ? "pickup" : "delivery")}
          <span>{say(data.progress?.method || "Fulfillment")}</span>
        </div>
        {!buyer && d?.destination?.name && (
          <p>
            {say("Buyer")}: <strong>{d.destination.name}</strong>
          </p>
        )}
      </section>
      {!guide.closed && !guide.review && (
        <section className="journey-card">
          <h2>{say("Order progress")}</h2>
          <ol className="journey-progress" aria-label={say("Order progress")}>
            {guide.steps.map((step, index) => (
              <li
                key={step}
                className={index <= guide.stage ? "reached" : ""}
                aria-current={index === guide.stage ? "step" : undefined}
              >
                <span aria-hidden="true">{index < guide.stage ? "✓" : index + 1}</span>
                <small>{say(step)}</small>
              </li>
            ))}
          </ol>
        </section>
      )}
      <section
        className={`journey-card journey-payment ${data.money?.progress?.tone === "warning" ? "journey-payment-warning" : ""}`}
      >
        <div>{icon("payment")}</div>
        <div>
          <h2>{say(guide.payment)}</h2>
          <p>
            {say(
              data.money?.progress?.body ||
                (data.progress?.confirmed
                  ? "Receipt is confirmed. Payment is tracked separately."
                  : "Handover does not release the farmer’s payment."),
            )}
          </p>
        </div>
      </section>
      {buyer &&
        data.progress?.method === "Pickup" &&
        data.fulfillment?.state === "ACTIVE" &&
        !data.fulfillment.collectionBuyerAt && (
          <button disabled={busy} onClick={() => void run("collection-confirmation")}>
            {say("Confirm pickup arrangement")}
          </button>
        )}
      {data.progress?.method === "Pickup" && !guide.closed && (
        <section className="journey-card">
          <h2>{say("Pickup location")}</h2>
          <p>
            {o.suggestedPickup.address}, {o.suggestedPickup.state}
          </p>
          {d?.package?.pickupDate && <p>{d.package.pickupDate}</p>}
          {buyer && o.pickupContactAvailable && o.suggestedPickup.phone && (
            <a href={`tel:${o.suggestedPickup.phone}`}>{say("Call farmer")}</a>
          )}
          {!buyer && d?.destination?.phone && (
            <a href={`tel:${d.destination.phone}`}>{say("Call buyer")}</a>
          )}
        </section>
      )}
      {d?.trackingUrl?.startsWith("https://") && (
        <a className="journey-link" target="_blank" rel="noreferrer" href={d.trackingUrl}>
          {say("Track delivery")} ↗
        </a>
      )}
      {data.progress?.canReject && !buyer && !reject && (
        <button className="secondary" disabled={busy} onClick={() => setReject(true)}>
          {say("Cannot fulfill this order")}
        </button>
      )}
      {reject && (
        <form
          className="journey-card"
          onSubmit={(e) => {
            e.preventDefault();
            void run("decision", { accept: false, reason });
          }}
        >
          <h2>{say("Decline Order")}</h2>
          <label>
            {say("Reason")}
            <textarea
              required
              minLength={5}
              maxLength={500}
              disabled={busy}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <p>{say("The buyer will be notified and the refund will be reviewed.")}</p>
          <button disabled={busy || reason.trim().length < 5}>{say("Decline Order")}</button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => setReject(false)}
          >
            {say("Keep order")}
          </button>
        </form>
      )}
      <details>
        <summary>{say("Order details")}</summary>
        <p>{o.description}</p>
        <p>
          {say("Number of packages")}:{" "}
          {d?.package?.packageCount || o.packageSuggestion?.packageCount || 1}
        </p>
        <p>{d?.package?.notes || o.packageSuggestion?.notes}</p>
        {o.rejectionReason && <p>{o.rejectionReason}</p>}
      </details>
      <details>
        <summary>{say("Payment and receipt")}</summary>
        <CustomerPayment
          orderId={o.id}
          isBuyer={buyer}
          onChanged={onRefresh}
          revision={`${o.status}:${d?.status}`}
          disabled={busy}
        />
        <CustomerRecovery orderId={o.id} />
        {o.receiptPhoto && (
          <a
            href={`/api/customer/orders/${o.id}/delivery/receipt-photo`}
            target="_blank"
            rel="noreferrer"
          >
            {say("View receipt photo")}
          </a>
        )}
      </details>
      <details>
        <summary>{say("Order notifications")}</summary>
        <ol className="journey-history">
          {d?.events?.map((event: any) => (
            <li key={event.id}>
              <strong>{say(orderUpdateCopy(`status.${event.status}`, buyer).title)}</strong>
              <p>{new Date(event.createdAt).toLocaleString(locale)}</p>
            </li>
          ))}
        </ol>
      </details>
      <details>
        <summary>{say("Report a Problem")}</summary>
        <CustomerOrderIssues orderId={o.id} onChanged={onRefresh} />
      </details>
      <button
        className="secondary"
        disabled={busy}
        onClick={() => {
          void onRefresh().catch((e) => setError(localizedError(locale, e)));
        }}
      >
        {say("Refresh order")}
      </button>
      {guide.action && !reject && (
        <footer className="journey-action">
          {handoff ? (
            <>
              <h2>{say("Have all goods been handed over?")}</h2>
              <p>{say("Buyer confirmation is still required before payment release.")}</p>
              <button disabled={busy} onClick={() => void run(guide.action!)}>
                {say(guide.label)}
              </button>
              <button className="secondary" disabled={busy} onClick={() => setHandoff(false)}>
                {say("Cancel")}
              </button>
            </>
          ) : (
            <>
              <button disabled={busy} onClick={act}>
                {say(busy ? "Saving…" : guide.label)}
              </button>
              <small>{say(guide.after)}</small>
            </>
          )}
        </footer>
      )}
      <dialog
        className="journey-receipt"
        ref={confirmationRef}
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setConfirm(false);
        }}
        aria-labelledby="receipt-heading"
      >
        <div className="journey-receipt-emblem">
          <img src="/order-icons/receipt.svg" width={44} height={44} alt="" />
        </div>
        <h2 id="receipt-heading">{say("Inspect your goods")}</h2>
        <p>{say("Check the quantity, produce and condition.")}</p>
        <label>
          {say("Add a receipt photo")}
          <input
            type="file"
            accept="image/jpeg,image/png"
            disabled={busy}
            onChange={(e) => {
              const photo = e.target.files?.[0];
              setAck(false);
              if (
                photo &&
                (!["image/jpeg", "image/png"].includes(photo.type) ||
                  photo.size > 10485760 ||
                  !photo.size)
              ) {
                setError(say("Choose a JPEG or PNG photo smaller than 10 MB."));
                return;
              }
              setFile(photo || null);
              setError("");
            }}
          />
        </label>
        {preview && (
          <img className="journey-photo" src={preview} alt={say("Receipt photo preview")} />
        )}
        <label className="journey-checkbox">
          <input
            type="checkbox"
            checked={ack}
            disabled={busy}
            onChange={(e) => setAck(e.target.checked)}
          />
          {say(
            "I inspected all goods. Confirming starts the farmer’s payment release after the required checks.",
          )}
        </label>
        {error && <p role="alert">{error}</p>}
        <button
          disabled={busy || !file || !ack || !data.progress?.canConfirm}
          onClick={() => void submitReceipt()}
        >
          {say(busy ? "Saving…" : "Confirm Receipt")}
        </button>
        <button className="secondary" disabled={busy} onClick={() => setConfirm(false)}>
          {say("Go back / report a problem")}
        </button>
      </dialog>
    </section>
  );
}
