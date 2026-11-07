"use client";
import { useEffect, useRef, useState } from "react";
import { deliveryCalendarDate } from "../../../../packages/contracts/src/delivery-visibility";
import { formatMoney } from "../../../../packages/contracts/src/money";
import type { Contact } from "../../../mobile/src/lib/domain";
import { financeDate } from "./finance-ui";
import { OrderFacts } from "./order-ui";
import type { AdminOrderRecord } from "./order-types";
import type { OrderRecordWorkflow } from "./use-order-record";

const emptyContact: Contact = { name: "", email: "", phone: "", address: "", state: "", country: "NG" };
const contactFields = [["name", "Contact name"], ["email", "Email"], ["phone", "Phone"], ["address", "Address"], ["state", "State"]] as const;

export function DeliverySetup({ data, workflow }: { data: AdminOrderRecord; workflow: OrderRecordWorkflow }) {
  const d = data.delivery, packing = data.order.packageSuggestion;
  const [destination, setDestination] = useState<Contact>(d?.destination || emptyContact);
  const [now, setNow] = useState(Date.now());
  const initialized = useRef(d?.package?.quoteRequestId);
  useEffect(() => {
    if (!workflow.dirty && initialized.current !== d?.package?.quoteRequestId) {
      initialized.current = d?.package?.quoteRequestId;
      setDestination(d?.destination || emptyContact);
    }
  }, [d?.destination, d?.package?.quoteRequestId, workflow.dirty]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!workflow.available("quotes") && !workflow.available("select")) return null;
  return <section className="live-card" aria-label="Arrange delivery">
    <h2>Delivery details & quotes</h2>
    <p className="finance-muted">Confirm the contacts and pickup date before the buyer pays. Packing comes from the farmer’s saved produce details.</p>
    {workflow.dirty && <p className="finance-callout" role="status">You have unsaved delivery details. Get new quotes before selecting a courier.</p>}
    {workflow.available("quotes") && packing && <form className="operations-setup" aria-label="Get delivery quotes" onChange={workflow.markDirty} onSubmit={event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      void workflow.execute("quotes", { pickup: { ...data.order.suggestedPickup, email: form.get("pickup.email") }, destination, parcel: { pickupDate: form.get("pickupDate") } });
    }}>
      <div className="operations-grid">
        <fieldset className="operations-form-fields" disabled={workflow.disabled}><legend>Pickup contact</legend>
          {contactFields.map(([name, label]) => <label key={name}>{label}<input name={`pickup.${name}`} required type={name === "email" ? "email" : name === "phone" ? "tel" : "text"} readOnly={name !== "email" || !!data.order.suggestedPickup.email} defaultValue={data.order.suggestedPickup[name] || ""} /></label>)}
        </fieldset>
        <fieldset className="operations-form-fields" disabled={workflow.disabled}><legend>Drop-off contact</legend>
          {contactFields.map(([name, label]) => <label key={name}>{label}<input name={`destination.${name}`} required type={name === "email" ? "email" : name === "phone" ? "tel" : "text"} value={destination[name] || ""} onChange={event => setDestination(current => ({ ...current, [name]: event.target.value, ...(["address", "state"].includes(name) ? { addressId: undefined, latitude: undefined, longitude: undefined } : {}) }))} /></label>)}
          <label>Digital postcode (optional)<input name="postalCode" maxLength={40} value={destination.postalCode || ""} onChange={event => setDestination(current => ({ ...current, postalCode: event.target.value }))} /></label>
          <label>Additional directions (optional)<textarea name="instructions" maxLength={700} value={destination.instructions || ""} onChange={event => setDestination(current => ({ ...current, instructions: event.target.value }))} /></label>
        </fieldset>
      </div>
      <OrderFacts items={[["Packages", packing.packageCount], ["Weight per package", `${packing.weightKg} kg`], ["Size per package", `${packing.length} × ${packing.width} × ${packing.height} cm`]]} />
      <label>Pickup date<input name="pickupDate" type="date" required disabled={workflow.disabled} min={deliveryCalendarDate(new Date(now))} max={deliveryCalendarDate(new Date(now + 7 * 86400000))} defaultValue={d?.package?.pickupDate || deliveryCalendarDate(new Date(now + 86400000))} /></label>
      <button disabled={workflow.disabled}>Get delivery quotes</button>
    </form>}
    {!!d?.quotes.length && <div className="operations-quotes" aria-label="Courier quotes">
      {d.quotes.map(quote => {
        const expired = new Date(quote.expiresAt).getTime() <= now, selected = quote.id === d.selectedQuoteId;
        return <article className="finance-operation-card" key={quote.id}>
          <h3>{quote.courier} · {formatMoney(quote.amountMinor)}</h3>
          {quote.eta && <p>Estimated delivery: {quote.eta}</p>}
          {quote.recommended && <p>Recommended{quote.recommendationReason ? ` · ${quote.recommendationReason}` : ""}</p>}
          {quote.quality?.rating != null && !!quote.quality.votes && <p>Courier rating: {quote.quality.rating}/5 ({quote.quality.votes} ratings)</p>}
          <small>Valid until {financeDate(quote.expiresAt)} (WAT)</small>
          <button className="secondary" aria-pressed={selected} disabled={workflow.disabled || workflow.dirty || expired || !quote.available || selected || !workflow.available("select")} onClick={() => void workflow.execute("select", { quoteId: quote.id })}>{expired ? "Quote expired" : !quote.available ? "Not available" : selected ? "Selected" : "Select courier"}</button>
        </article>;
      })}
    </div>}
  </section>;
}
