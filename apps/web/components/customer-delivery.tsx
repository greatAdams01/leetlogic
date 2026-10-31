"use client";
import { CustomerPayment } from "./customer-payments";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TranslatedText } from "./translated-text";
import { customerApi } from "../lib/customer-api";
import { useLanguage } from "./language-provider";
import type { MessageKey } from "../lib/locales/messages";
import { formatMoney as money } from "../../../packages/contracts/src/money";
import { ui, localizedError } from "../../mobile/src/lib/localization";
import { CustomerAddresses } from "./customer-addresses";
import { addressInstructions, addressText, postcodeStatus } from "../../../packages/contracts/src/addresses";
import { savedFarmPoint } from "../../mobile/src/lib/farm-location";
import type { Address, Contact } from "../../mobile/src/lib/domain";
export function CustomerDelivery({
  id,
  staff = false,
  staffPermissions = [],
}: {
  id: string;
  staff?: boolean;
  staffPermissions?: string[];
}) {
  const { t, locale } = useLanguage();
  const say = (text: string, params: Record<string, string | number> = {}) => ui(locale, text, params);
  const error = (value: unknown) => localizedError(locale, value);
  const [data, setData] = useState<any>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const requestVersion = useRef(0);
  const [dirty, setDirty] = useState(false);
  const context = useRef({ id, staff, dirty });
  context.current = { id, staff, dirty };
  const [now, setNow] = useState(Date.now());
  const [stepUpCode, setStepUpCode] = useState("");
  const [customer, setCustomer] = useState<any>(null);
  const [destination, setDestination] = useState<Contact>({ name: "", email: "", phone: "", address: "", state: "", country: "NG" });
  const initializedDestination = useRef("");
  const markDirty = () => { context.current.dirty = true; setDirty(true); };
  const chooseAddress = (address?: Address) => {
    markDirty();
    setDestination((current) => ({ ...current, addressId: address?.id,
      ...(address ? { address: addressText(address), state: address.state, postalCode: address.postalCode, instructions: addressInstructions(address) } : {}),
      latitude: address ? savedFarmPoint(address)?.latitude : undefined,
      longitude: address ? savedFarmPoint(address)?.longitude : undefined,
    }));
  };
  const manage = !staff || staffPermissions.includes("orders.manage");
  const call = useCallback(async (suffix = "", body?: unknown) => {
    if (!staff) return customerApi(`orders/${id}/delivery${suffix}`, body);
    const response = await fetch(`/api/admin/delivery-orders/${id}/delivery${suffix}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error?.message || "Request failed"), { code: result.error?.code });
    return result;
  }, [id, staff]);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const latest = await call();
      if (version !== requestVersion.current) return null;
      setData(latest);
      return latest;
    } catch (error) {
      if (version !== requestVersion.current) return null;
      throw error;
    }
  }, [call]);
  const copy = useRef({ error });
  copy.current = { error };
  useEffect(() => {
    setData(null);
    setDirty(false);
    setNotice("");
    void load().catch((e) => setNotice(copy.current.error(e)));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { requestVersion.current++; clearInterval(timer); };
  }, [load]);
  useEffect(() => {
    let active = true;
    setCustomer(null);
    if (!staff) void customerApi("me").then((result) => { if (active) setCustomer(result.user || null); }).catch(() => {});
    return () => { active = false; };
  }, [id, staff]);
  useEffect(() => {
    if (!data || data.order.id !== id) return;
    const key = `${id}:${data.delivery?.package?.quoteRequestId || "new"}`;
    if (initializedDestination.current === key) return;
    if (context.current.dirty && initializedDestination.current.startsWith(`${id}:`)) return;
    initializedDestination.current = key;
    setDestination(data.delivery?.status === "PICKUP_PENDING" ? { name: "", email: "", phone: "", address: "", state: "", country: "NG" } :
      data.delivery?.destination || { name: "", email: "", phone: "", address: "", state: "", country: "NG" });
  }, [data, id, dirty]);
  async function action(suffix: string, body: unknown) {
    const currentContext = () => context.current.id === id && context.current.staff === staff;
    if (running.current || !currentContext()) return;
    if (suffix === "/select" && (context.current.dirty || data.order.checkoutActive || !data.delivery?.quotes.some((quote: any) =>
      quote.id === (body as { quoteId: string }).quoteId && quote.available && new Date(quote.expiresAt).getTime() > Date.now()))) return;
    running.current = true;
    setBusy(true);
    setNotice("");
    try {
      if (staff && (["/payment", "/link", "/cancel"].includes(suffix) || /^\/parcels\/[^/]+\/link$/.test(suffix))) {
        const check = await fetch("/api/admin/auth/totp/step-up", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: stepUpCode }),
        });
        const result = await check.json();
        if (!check.ok)
          throw new Error(result.error?.message || "Authenticator confirmation failed");
        if (!currentContext()) return;
        setStepUpCode("");
      }
      const result = await call(suffix, body);
      if (!currentContext()) return;
      if (result.message) setNotice(result.message);
      await load();
      if (currentContext() && ["/quotes", "/select", "/collection", "/refresh-quote"].includes(suffix)) setDirty(false);
    } catch (e) {
      if (!currentContext()) return;
      setNotice(error(e));
      // Failed requotes invalidate the previous choice on the server too.
      await load().catch(() => { if (currentContext()) setData(null); });
    } finally {
      running.current = false;
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
      pickup: { ...data.order.suggestedPickup, email: form.get("pickup.email") },
      destination: { ...destination, ...contact("destination"), postalCode: form.get("destination.postalCode") || null, instructions: form.get("destination.instructions") || "" },
      parcel: { pickupDate: form.get("date") },
    });
  }
  if (!data || data.order.id !== id)
    return (
      <section className="customer-panel">
        <h1>{t("delivery.title")}</h1>
        <p role="status">{notice || t("common.loading")}</p>
        <Link href="/account">{t("auth.required")}</Link>
      </section>
    );
  const d = data.delivery;
  const packing = data.order.packageSuggestion;
  const selected = d?.quotes.find((quote: any) => quote.id === d.selectedQuoteId);
  const collection = ["PICKUP_PENDING", "PICKUP_READY"].includes(d?.status);
  const currentQuote = !!selected?.available && new Date(selected.expiresAt).getTime() > now;
  const checkoutCurrent = data.order.checkoutReady && !dirty &&
    (!data.order.quoteExpiresAt || new Date(data.order.quoteExpiresAt).getTime() > now);
  const quoted = !dirty && (collection || currentQuote || (data.order.status !== "AWAITING_PAYMENT" && !!d?.selectedQuoteId));
  const canEdit = manage && (staff || data.order.isBuyer) && data.order.status === "AWAITING_PAYMENT" &&
    !data.order.checkoutActive && !d?.paidMinor?.match(/[1-9]/) && !d?.bookingStartedAt && !d?.providerShipmentId;
  const savedDestination: Address | undefined = customer?.addresses?.find((address: Address) => address.id === destination.addressId);
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
        <dd>{quoted ? money(d?.shippingMinor || "0") : say("Not quoted")}</dd>
        <dt>{t("orders.total")}</dt>
        <dd>{data.order.totalWithDeliveryMinor && (checkoutCurrent || data.order.status !== "AWAITING_PAYMENT")
          ? money(data.order.totalWithDeliveryMinor) : say("Not available")}</dd>
      </dl>
      <p>{t("delivery.payment")}</p>
      {!staff && (
        <CustomerPayment
          orderId={id}
          isBuyer={data.order.isBuyer}
          topup={d?.status === "TOPUP_REQUIRED"}
          onChanged={load}
          revision={`${d?.selectedQuoteId}:${d?.status}:${d?.shippingMinor}:${data.order.checkoutReady}:${data.order.checkoutErrorCode}`}
          disabled={busy || dirty}
        />
      )}
      {d && (
        <>
          <h2>{t(`status.${d.status}` as MessageKey) || d.status}</h2>
          {d.failureCode && <p role="status">{staff ? d.failureCode : error({ code: d.failureCode })}</p>}
          {d.trackingUrl?.startsWith("https://") && (
            <a href={d.trackingUrl} target="_blank" rel="noreferrer">
              {t("delivery.tracking")}
            </a>
          )}
          {d.parcels?.map((parcel: any) => (
            <article key={parcel.id}>
              <h3>{say("Parcel {number}", { number: parcel.parcelIndex + 1 })}</h3>
              <p>{t(`status.${parcel.status}` as MessageKey) || parcel.status}</p>
              {parcel.trackingUrl?.startsWith("https://") && (
                <a href={parcel.trackingUrl} target="_blank" rel="noreferrer">{t("delivery.tracking")}</a>
              )}
            </article>
          ))}
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
      <button disabled={busy} onClick={() => load().catch((e) => setNotice(error(e)))}>
        {t("delivery.refresh")}
      </button>
      {data.order.checkoutActive && <p role="status">{error({ code: "CHECKOUT_ACTIVE" })}</p>}
      {dirty && <p role="status">{error({ code: "STALE_DELIVERY_QUOTE" })}</p>}
      {canEdit && !staff && (
        <button disabled={busy} onClick={() => action("/collection", {})}>{say("Pickup")}</button>
      )}
      {canEdit && !packing && <p role="status">{error({ code: "PACKING_REQUIRED" })}</p>}
      {canEdit && !staff && customer && <details>
        <summary>{say("Add or verify a delivery address")}</summary>
        <CustomerAddresses addresses={customer.addresses || []} onSaved={async (address) => {
          if (context.current.id !== id || context.current.staff !== staff) return;
          setCustomer((current: any) => ({ ...current, addresses: [...(current.addresses || []).filter((item: Address) => item.id !== address.id), address] }));
          chooseAddress(address);
          await load();
        }} />
      </details>}
      {canEdit && packing && (
          <form key={`${id}:${staff}`} onSubmit={quotes} onChange={markDirty}>
            {!staff && customer?.addresses?.length > 0 && <label>{say("Saved delivery address")}
              <select disabled={busy} value={destination.addressId || ""} onChange={(e) => chooseAddress(customer.addresses.find((address: Address) => address.id === e.target.value))}>
                <option value="">{say("Enter address manually")}</option>
                {customer.addresses.map((address: Address) => <option key={address.id} value={address.id}>{address.label}: {address.line1}, {address.state}{address.postalCode ? ` · ${address.postalCode}` : ""}</option>)}
              </select>
            </label>}
            {savedDestination && <p>{say(postcodeStatus(savedDestination))}</p>}
            {["pickup", "destination"].map((prefix) => (
              <fieldset key={prefix} disabled={busy}>
                <legend>{t(`delivery.${prefix}` as MessageKey)}</legend>
                {["name", "email", "phone", "address", "state"].map((key) => (
                  <label key={key}>
                    {t(`delivery.${key}` as MessageKey)}
                    <input
                      name={`${prefix}.${key}`}
                      required
                      readOnly={prefix === "pickup" && (key !== "email" || !!data.order.suggestedPickup.email) || prefix === "destination" && !!savedDestination && ["address", "state"].includes(key)}
                      type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
                      value={prefix === "pickup" && (key !== "email" || !!data.order.suggestedPickup.email)
                        ? data.order.suggestedPickup?.[key] || "" : prefix === "destination"
                          ? key === "address" && savedDestination ? addressText(savedDestination) : key === "state" && savedDestination ? savedDestination.state : destination[key as keyof Contact] || "" : undefined}
                      defaultValue={prefix === "pickup" && key === "email" && !data.order.suggestedPickup.email ? "" : undefined}
                      onChange={prefix === "destination" ? (e) => setDestination((current) => ({ ...current, [key]: e.target.value,
                        ...(["address", "state"].includes(key) ? { addressId: undefined, latitude: undefined, longitude: undefined } : {}) })) : undefined}
                    />
                  </label>
                ))}
              </fieldset>
            ))}
            <label>{say("Digital postcode (optional)")}<input name="destination.postalCode" readOnly={!!savedDestination} disabled={busy}
              value={savedDestination?.postalCode || destination.postalCode || ""} onChange={(e) => setDestination((current) => ({ ...current, postalCode: e.target.value }))} maxLength={40} /></label>
            <label>{say("Additional directions (optional)")}<textarea name="destination.instructions" readOnly={!!savedDestination} disabled={busy}
              value={savedDestination ? addressInstructions(savedDestination) : destination.instructions || ""} onChange={(e) => setDestination((current) => ({ ...current, instructions: e.target.value }))} maxLength={700} /></label>
            {data.order.packageSuggestion && (
              <p>
                {say("Calculated from the farmer’s saved shipping details and your order quantity.")}
              </p>
            )}
            <label>
              {t("delivery.parcelCount")}
              <input
                readOnly
                name="packageCount"
                type="number"
                min="1"
                step="1"
                required
                value={packing?.packageCount || 1}
              />
            </label>
            {["weight", "length", "width", "height"].map((key) => (
              <label key={key}>
                {t(`delivery.${key}` as MessageKey)}
                <input
                  readOnly
                  name={key}
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  value={packing?.[key === "weight" ? "weightKg" : key] ?? ""}
                />
              </label>
            ))}
            <label>
              {t("delivery.date")}
              <input
                name="date"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                max={new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)}
                disabled={busy}
                defaultValue={
                  d?.package?.pickupDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10)
                }
                required
              />
            </label>
            <label>
              {t("delivery.handling")}
              <select name="handling" disabled value={packing.handling}>
                <option value="STANDARD">{t("delivery.handling.STANDARD")}</option>
                <option value="PERISHABLE">{t("delivery.handling.PERISHABLE")}</option>
                <option value="COLD_CHAIN">{t("delivery.handling.COLD_CHAIN")}</option>
                <option value="BULK">{t("delivery.handling.BULK")}</option>
              </select>
            </label>
            <label>
              {t("delivery.instructions")}
              <textarea name="notes" readOnly value={[packing.notes, packing.pickupInstructions].filter(Boolean).join(" · ")} />
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
            {quote.recommended && <p>{say("⚡ RECOMMENDED")}</p>}
            {quote.recommendationReason && <p>{say(quote.recommendationReason)}</p>}
            {quote.quality?.rating != null && quote.quality.votes > 0 && (
              <p>{say("Provider rating: {rating}/5 ({votes} ratings)", { rating: quote.quality.rating, votes: quote.quality.votes })}</p>
            )}
            <button
              aria-pressed={d.selectedQuoteId === quote.id}
              disabled={busy || dirty || data.order.checkoutActive || !quote.available || !(new Date(quote.expiresAt).getTime() > now) || d.selectedQuoteId === quote.id}
              onClick={() => action("/select", { quoteId: quote.id })}
            >
              {new Date(quote.expiresAt).getTime() <= now
                ? t("delivery.expired")
                : !quote.available ? say("Not available")
                : d.selectedQuoteId === quote.id ? say("Selected")
                : t("delivery.select")}
            </button>
          </article>
        ))}
      {manage &&
        (staff || data.order.isBuyer) &&
        d?.selectedQuoteId &&
        !d?.providerShipmentId &&
        !d?.bookingStartedAt && (
          <button disabled={busy || dirty || data.order.checkoutActive} onClick={() => action("/refresh-quote", {})}>
            {say("Revalidate selected quote")}
          </button>
        )}
      {manage && (staff || data.order.isBuyer) && ["PAID", "BOOKING_BLOCKED"].includes(d?.status) && !d?.bookingStartedAt && data.order.status === "FUNDED" && (
        <button disabled={busy} onClick={() => action("/book", {})}>
          {t("delivery.book")}
        </button>
      )}
      {!staff &&
        data.order.isBuyer &&
        ["DELIVERED", "PICKUP_READY"].includes(d?.status) &&
        data.order.status === "FUNDED" && (
          <button disabled={busy} onClick={() => action("/confirm", {})}>
            {d.status === "PICKUP_READY" ? say("Confirm pickup received") : t("delivery.confirm")}
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
          {d.status === "BOOKING_UNCERTAIN" && !d.parcels?.length && (
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
          {d.status === "BOOKING_UNCERTAIN" && d.parcels?.filter((parcel: any) => ["BOOKING", "BOOKING_UNCERTAIN"].includes(parcel.status)).map((parcel: any) => (
            <form key={parcel.id} onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void action(`/parcels/${parcel.id}/link`, { providerShipmentId: form.get("providerShipmentId"), reason: form.get("reason") });
            }}>
              <h3>{say("Parcel {number}", { number: parcel.parcelIndex + 1 })}</h3>
              <label>Verified provider shipment ID<input name="providerShipmentId" required /></label>
              <label>Matching evidence and reason<input name="reason" minLength={10} required /></label>
              <button disabled={busy || !manage}>Link existing parcel shipment</button>
            </form>
          ))}
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
