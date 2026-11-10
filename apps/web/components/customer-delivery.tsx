"use client";
import { orderUpdateCopy } from "../../../packages/contracts/src/order-updates";
import { orderTabs, type OrderTab } from "../../../packages/contracts/src/order-fulfillment";
import { CustomerOrderIssues } from "./customer-order-issues";
import { CancelUnpaidOrder } from "./cancel-unpaid-order";
import { GuidedOrder } from "./guided-order";
import { OrderSaleEarnings } from "./sale-earnings";
import { DeliveryTracking } from "./delivery-tracking";
import { deliveryVisibility } from "../../../packages/contracts/src/delivery-visibility";
import { financeDate, financeLabel, financeRequest } from "./admin/finance-ui";
import { userFacingError } from "../lib/user-facing-error";
import { CustomerRecovery } from "./customer-recovery";
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
import {
  addressInstructions,
  addressText,
  postcodeStatus,
} from "../../../packages/contracts/src/addresses";
import { savedFarmPoint } from "../../mobile/src/lib/farm-location";
import type { Address, Contact } from "../../mobile/src/lib/domain";
export function CustomerDelivery({
  id,
  staff = false,
  staffPermissions = [],
  onChanged,
}: {
  id: string;
  staff?: boolean;
  staffPermissions?: string[];
  onChanged?: () => void;
}) {
  const { t, locale } = useLanguage();
  const say = (text: string, params: Record<string, string | number> = {}) =>
    ui(locale, text, params);
  const error = (value: unknown) => staff ? userFacingError(value) : localizedError(locale, value);
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<OrderTab>("details");
  const [reportIssue, setReportIssue] = useState(false);
  const [confirmation, setConfirmation] = useState<"confirm" | "dispatch" | null>(null);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const requestVersion = useRef(0);
  const [dirty, setDirty] = useState(false);
  const context = useRef({ id, staff, dirty });
  context.current = { id, staff, dirty };
  const [now, setNow] = useState(Date.now());
  const [stepUpCode, setStepUpCode] = useState("");
  const [customer, setCustomer] = useState<any>(null);
  const [destination, setDestination] = useState<Contact>({
    name: "",
    email: "",
    phone: "",
    address: "",
    state: "",
    country: "NG",
  });
  const initializedDestination = useRef("");
  const markDirty = () => {
    context.current.dirty = true;
    setDirty(true);
  };
  const chooseAddress = (address?: Address) => {
    markDirty();
    setDestination((current) => ({
      ...current,
      addressId: address?.id,
      ...(address
        ? {
            address: addressText(address),
            state: address.state,
            postalCode: address.postalCode,
            instructions: addressInstructions(address),
          }
        : {}),
      latitude: address ? savedFarmPoint(address)?.latitude : undefined,
      longitude: address ? savedFarmPoint(address)?.longitude : undefined,
    }));
  };
  const manage = !staff || staffPermissions.includes("orders.manage");
  const call = useCallback(
    async (suffix = "", body?: unknown) => {
      if (!staff) return customerApi(`orders/${id}/delivery${suffix}`, body);
      return financeRequest(`delivery-orders/${id}/delivery${suffix}`, body);
    },
    [id, staff],
  );
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const latest = await call();
      if (version !== requestVersion.current) return null;
      setData(latest);
      setLoadError("");
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
    setLoadError("");
    void load().catch((e) => setLoadError(copy.current.error(e)));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    let refreshing = false;
    const refresh = () => {
      if (refreshing || running.current || document.visibilityState !== "visible") return;
      refreshing = true;
      void load()
        .catch((e) => setLoadError(copy.current.error(e)))
        .finally(() => {
          refreshing = false;
        });
    };
    const updates = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      requestVersion.current++;
      clearInterval(timer);
      clearInterval(updates);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  useEffect(() => {
    let active = true;
    setCustomer(null);
    if (!staff)
      void customerApi("me")
        .then((result) => {
          if (active) setCustomer(result.user || null);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [id, staff]);
  useEffect(() => {
    if (!data || data.order.id !== id) return;
    const key = `${id}:${data.delivery?.package?.quoteRequestId || "new"}`;
    if (initializedDestination.current === key) return;
    if (context.current.dirty && initializedDestination.current.startsWith(`${id}:`)) return;
    initializedDestination.current = key;
    setDestination(
      data.delivery?.status === "PICKUP_PENDING"
        ? { name: "", email: "", phone: "", address: "", state: "", country: "NG" }
        : data.delivery?.destination || {
            name: "",
            email: "",
            phone: "",
            address: "",
            state: "",
            country: "NG",
          },
    );
  }, [data, id, dirty]);
  async function action(suffix: string, body: unknown) {
    const currentContext = () => context.current.id === id && context.current.staff === staff;
    if (running.current || !currentContext()) return;
    if (staff && loadError) return;
    if (staff && !staffPermissions.includes(suffix === "/payment" ? "payments.manage" : "orders.manage")) return;
    if (
      suffix === "/select" &&
      (context.current.dirty ||
        data.order.checkoutActive ||
        !data.delivery?.quotes.some(
          (quote: any) =>
            quote.id === (body as { quoteId: string }).quoteId &&
            quote.available &&
            new Date(quote.expiresAt).getTime() > Date.now(),
        ))
    )
      return;
    running.current = true;
    setBusy(true);
    setNotice("");
    try {
      if (
        staff &&
        (["/payment", "/link", "/cancel"].includes(suffix) ||
          /^\/parcels\/[^/]+\/link$/.test(suffix))
      ) {
        await financeRequest("auth/totp/step-up", { code: stepUpCode });
        if (!currentContext()) return;
        setStepUpCode("");
      }
      const result = await call(suffix, body);
      if (!currentContext()) return;
      if (result.message) setNotice(result.message);
      await load();
      if (currentContext()) onChanged?.();
      if (
        currentContext() &&
        ["/quotes", "/select", "/collection", "/refresh-quote"].includes(suffix)
      )
        setDirty(false);
    } catch (e) {
      if (!currentContext()) return;
      setNotice(error(e));
      // Failed requotes invalidate the previous choice on the server too.
      await load().catch(() => {
        if (currentContext()) setData(null);
      });
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
      destination: {
        ...destination,
        ...contact("destination"),
        postalCode: form.get("destination.postalCode") || null,
        instructions: form.get("destination.instructions") || "",
      },
      parcel: { pickupDate: form.get("date") },
    });
  }
  if (!data || data.order.id !== id)
    return (
      <section className="customer-panel">
        <h1>{t("delivery.title")}</h1>
        <p role="status">{notice || loadError || t("common.loading")}</p>
        <Link href="/account">{t("auth.required")}</Link>
      </section>
    );
   if (!staff && data.order.status !== "AWAITING_PAYMENT") return <GuidedOrder key={data.order.id} data={data} notice={notice} loadError={loadError} onRefresh={load} />;
  const d = data.delivery;
  const tracking = data.tracking !== undefined ? data.tracking : d && data.progress?.method !== "Pickup"
    ? deliveryVisibility({ ...d, orderStatus: data.order.status, receiptConfirmedAt: data.order.deliveryConfirmedAt }) : null;
  const packing = data.order.packageSuggestion;
  const selected = d?.quotes.find((quote: any) => quote.id === d.selectedQuoteId);
  const collection = ["PICKUP_PENDING", "PICKUP_READY"].includes(d?.status);
  const currentQuote = !!selected?.available && new Date(selected.expiresAt).getTime() > now;
  const checkoutCurrent =
    data.order.checkoutReady &&
    !dirty &&
    (!data.order.quoteExpiresAt || new Date(data.order.quoteExpiresAt).getTime() > now);
  const quoted =
    !dirty &&
    (collection ||
      currentQuote ||
      (data.order.status !== "AWAITING_PAYMENT" && !!d?.selectedQuoteId));
  const canEdit =
    manage &&
    (staff || data.order.isBuyer) &&
    data.order.status === "AWAITING_PAYMENT" &&
    !data.order.checkoutActive &&
    !d?.paidMinor?.match(/[1-9]/) &&
    !d?.bookingStartedAt &&
    !d?.providerShipmentId;
  const savedDestination: Address | undefined = customer?.addresses?.find(
    (address: Address) => address.id === destination.addressId,
  );
  const tabbed = !staff && data.order.status !== "AWAITING_PAYMENT";
  const visible = (value: OrderTab) => !tabbed || tab === value;
  const primary = data.progress?.canConfirm
    ? {
        label: data.progress.method === "Pickup" ? "Confirm Pickup" : "Confirm Delivery Received",
        path: "confirm",
      }
    : data.progress?.canDispatch
      ? { label: "Mark as Dispatched", path: "dispatch" }
      : data.progress?.canReady
        ? {
            label:
              data.progress.method === "Pickup"
                ? "Mark as Ready for Pickup"
                : "Mark as Ready for Delivery",
            path: "ready",
          }
        : null;
  return (
    <section className="customer-panel order-workspace">
      <h1>{data.order.title}</h1>
      <p>{data.order.reference}</p>
      {!staff && !data.order.isBuyer && data.money?.sellerEarnings && <OrderSaleEarnings amounts={data.money.sellerEarnings} />}
      {staff && data.staffContext && (
        <section className="dispatch-order-context">
          <h2>Order overview</h2>
          <dl className="finance-facts">
            {[
              ["Order status", financeLabel(data.order.status)],
              ["Buyer", `${data.staffContext.buyer.name} · ${data.staffContext.buyer.phone}`],
              ["Farmer", `${data.staffContext.farmer.name} · ${data.staffContext.farmer.farmName}`],
              ["Farmer confirmation", `${financeLabel(data.order.farmerDecision)} · ${financeDate(data.staffContext.farmerDecidedAt)}`],
              ["Payment", data.staffContext.manualFundingRecorded ? "Manual escrow funded — provider verification is not implied" : data.money?.progress?.title || "Not verified"],
              ["Produce funds held", money(data.money?.heldMinor || "0")],
              ["Farmer payment", data.money?.progress?.transfer || "Not started"],
              ["Receipt confirmation", data.order.deliveryConfirmedAt ? financeDate(data.order.deliveryConfirmedAt) : "Not confirmed"],
              ["Order created", financeDate(data.staffContext.createdAt)],
              ["Snapshot loaded", financeDate(data.observedAt)],
            ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          {data.order.rejectionReason && <p>Farmer reason: {data.order.rejectionReason}</p>}
          {data.staffContext.financialHold && <p className="delivery-warning" role="status">Financial hold: fulfillment and settlement need review.</p>}
          {data.staffContext.disputes.map((dispute: any) => <p key={dispute.id} className="delivery-warning">
            Open dispute: {dispute.subject} · {financeLabel(dispute.status)}
            {staffPermissions.includes("support.read") && <> · <Link href={`/admin/disputes?id=${dispute.id}`}>Review dispute</Link></>}
          </p>)}
          {data.fulfillment && <p>Fulfillment deadline: {financeLabel(data.fulfillment.state)} · {financeDate(data.fulfillment.refundDueAt)}. Existing deadlines are unchanged.</p>}
          {staffPermissions.includes("payments.read") && <Link href={`/admin/reconciliation/orders/${id}`}>Open payment reconciliation</Link>}
        </section>
      )}
      {!staff && data.order.status === "AWAITING_PAYMENT" && !data.order.checkoutActive && <CancelUnpaidOrder orderId={data.order.id} onChanged={load} />}
      {data.progress && (
        <div className="order-summary">
          <strong>
            {say(data.progress.status)} · {say(data.progress.method)}
          </strong>
          <p>{say(data.progress.next)}</p>
          <ol className="order-progress" aria-label={say("Order progress")}>
            {data.progress.steps.map((label: string, index: number) => (
              <li
                key={label}
                aria-current={index === data.progress.stage ? "step" : undefined}
                className={index <= data.progress.stage ? "reached" : ""}
              >
                {say(label)}
              </li>
            ))}
          </ol>
        </div>
      )}
      {primary && !staff && (
        <div className="order-primary">
          <button
            disabled={busy}
            onClick={() => {
              if (primary.path === "ready") void action("/ready", {});
              else setConfirmation(primary.path as "confirm" | "dispatch");
            }}
          >
            {say(primary.label)}
          </button>
          {data.order.isBuyer && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setTab("fulfillment");
                setReportIssue(true);
              }}
            >
              {say("Report an issue")}
            </button>
          )}
        </div>
      )}
      {confirmation && (
        <section
          className="order-confirmation"
          aria-label={say(confirmation === "confirm" ? "Confirm receipt" : "Confirm dispatch")}
        >
          <h2>{say(confirmation === "confirm" ? "Confirm receipt" : "Confirm dispatch")}</h2>
          <p>
            {say(
              confirmation === "confirm"
                ? "Only confirm after receiving and inspecting all items. Report an issue if anything is wrong."
                : "Confirm only after handing all parcels to the courier.",
            )}
          </p>
          <button
            disabled={busy}
            onClick={async () => {
              await action(`/${confirmation}`, {});
              setConfirmation(null);
            }}
          >
            {say(confirmation === "confirm" ? "I received it" : "Mark as Dispatched")}
          </button>
          <button disabled={busy} onClick={() => setConfirmation(null)}>
            {say("Cancel")}
          </button>
        </section>
      )}
      {tabbed && (
        <div className="order-tabs" role="tablist" aria-label={say("Order sections")}>
          {orderTabs.map((item) => (
            <button
              key={item.id}
              id={`order-tab-${item.id}`}
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`order-panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
              onKeyDown={(event) => {
                if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
                  event.preventDefault();
                  const index = orderTabs.findIndex((t) => t.id === tab);
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 3
                        : (index + (event.key === "ArrowRight" ? 1 : 3)) % 4;
                  setTab(orderTabs[next]!.id);
                  document.getElementById(`order-tab-${orderTabs[next]!.id}`)?.focus();
                }
              }}
            >
              {say(item.label)}
            </button>
          ))}
        </div>
      )}
      <div
        id={`order-panel-${tab}`}
        role={tabbed ? "tabpanel" : undefined}
        aria-labelledby={tabbed ? `order-tab-${tab}` : undefined}
      >
        {tabbed && <h2>{say(orderTabs.find((item) => item.id === tab)!.label)}</h2>}
        {visible("details") && (
          <>
            {!staff && data.order.isBuyer && data.order.checkoutErrorCode === "ORDER_EXPIRED" && (
              <div role="status">
                <p>{error({ code: "ORDER_EXPIRED" })}</p>
                <Link href={`/produce/${data.order.listingId}`}>{say("View produce")}</Link>
              </div>
            )}
            {!staff && data.order.description && (
              <TranslatedText
                resource="listings"
                id={data.order.listingId}
                original={data.order.description}
              />
            )}
            <p>
              {say("Quantity")}: {data.order.quantity} {data.order.unitCode}
            </p>
          </>
        )}
        {visible("payment") && (
          <>
            <dl>
              <dt>{t("orders.produce")}</dt>
              <dd>{money(data.order.totalMinor)}</dd>
              <dt>{t("orders.delivery")}</dt>
              <dd>{quoted ? money(d?.shippingMinor || "0") : say("Not quoted")}</dd>
              <dt>{t("orders.total")}</dt>
              <dd>
                {data.order.totalWithDeliveryMinor &&
                (checkoutCurrent || data.order.status !== "AWAITING_PAYMENT")
                  ? money(data.order.totalWithDeliveryMinor)
                  : say("Not available")}
              </dd>
            </dl>
            <p>{t("delivery.payment")}</p>
            {!staff && <CustomerRecovery orderId={id} />}
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
          </>
        )}
        {visible("fulfillment") && (
          <>
            <DeliveryTracking tracking={tracking} staff={staff} openTimeline={staff} />
            {!staff && (
              <section>
                <h3>{say("Pickup location")}</h3>
                <p>
                  {data.order.suggestedPickup.address}, {data.order.suggestedPickup.state}
                </p>
                {data.order.isBuyer &&
                  data.order.pickupContactAvailable &&
                  ["FUNDED", "DELIVERED", "COMPLETED"].includes(data.order.status) &&
                  data.order.suggestedPickup.phone && (
                    <a href={`tel:${data.order.suggestedPickup.phone}`}>{say("Call farmer")}</a>
                  )}
                {!data.order.isBuyer && d?.destination && (
                  <p>
                    {d.destination.name} · {d.destination.address}, {d.destination.state}
                  </p>
                )}
              </section>
            )}
            {!staff && data.order.isBuyer && (
              <CustomerOrderIssues orderId={id} autoOpen={reportIssue} onChanged={load} />
            )}
            {d && (
              <>
                <h2>{t(`status.${d.status}` as MessageKey) || d.status}</h2>
                {d.failureCode && (
                  <p role="status">{staff ? d.failureCode : error({ code: d.failureCode })}</p>
                )}
                {!tracking && d.parcels?.map((parcel: any) => (
                  <article key={parcel.id}>
                    <h3>{say("Parcel {number}", { number: parcel.parcelIndex + 1 })}</h3>
                    <p>{t(`status.${parcel.status}` as MessageKey) || parcel.status}</p>
                    {parcel.trackingUrl?.startsWith("https://") && (
                      <a href={parcel.trackingUrl} target="_blank" rel="noreferrer">
                        {t("delivery.tracking")}
                      </a>
                    )}
                  </article>
                ))}
                {!staff &&
                  data.order.isBuyer &&
                  data.fulfillment?.state === "ACTIVE" &&
                  ["PICKUP_PREPARING", "PICKUP_READY"].includes(d.status) &&
                  !data.fulfillment.collectionBuyerAt && (
                    <button disabled={busy} onClick={() => action("/collection-confirmation", {})}>
                      {say("Confirm pickup arrangement")}
                    </button>
                  )}
                {d.courier && <p>{d.courier}</p>}
                {d.package?.pickupDate && (
                  <p>
                    {t("delivery.date")}: {d.package.pickupDate}
                  </p>
                )}
                {d.providerShipmentId && (
                  <p>
                    {say(
                      "The courier receives your saved pickup contact and directions. Use shipment tracking for courier updates; contact support if pickup coordination fails.",
                    )}
                  </p>
                )}
              </>
            )}
            <button disabled={busy} onClick={() => load().catch((e) => setNotice(error(e)))}>
              {t("delivery.refresh")}
            </button>
            {data.order.checkoutActive && <p role="status">{error({ code: "CHECKOUT_ACTIVE" })}</p>}
            {dirty && <p role="status">{error({ code: "STALE_DELIVERY_QUOTE" })}</p>}
            {canEdit && !staff && (
              <button disabled={busy} onClick={() => action("/collection", {})}>
                {say("Pickup")}
              </button>
            )}
            {canEdit && !packing && <p role="status">{error({ code: "PACKING_REQUIRED" })}</p>}
            {canEdit && !staff && customer && (
              <details>
                <summary>{say("Add or verify a delivery address")}</summary>
                <CustomerAddresses
                  addresses={customer.addresses || []}
                  onSaved={async (address) => {
                    if (context.current.id !== id || context.current.staff !== staff) return;
                    setCustomer((current: any) => ({
                      ...current,
                      addresses: [
                        ...(current.addresses || []).filter(
                          (item: Address) => item.id !== address.id,
                        ),
                        address,
                      ],
                    }));
                    chooseAddress(address);
                    await load();
                  }}
                />
              </details>
            )}
            {canEdit && packing && (
              <form key={`${id}:${staff}`} onSubmit={quotes} onChange={markDirty}>
                {!staff && customer?.addresses?.length > 0 && (
                  <label>
                    {say("Saved delivery address")}
                    <select
                      disabled={busy}
                      value={destination.addressId || ""}
                      onChange={(e) =>
                        chooseAddress(
                          customer.addresses.find(
                            (address: Address) => address.id === e.target.value,
                          ),
                        )
                      }
                    >
                      <option value="">{say("Enter address manually")}</option>
                      {customer.addresses.map((address: Address) => (
                        <option key={address.id} value={address.id}>
                          {address.label}: {address.line1}, {address.state}
                          {address.postalCode ? ` · ${address.postalCode}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {savedDestination && <p>{say(postcodeStatus(savedDestination))}</p>}
                {["pickup", "destination"].map((prefix) => (
                  <fieldset key={prefix} disabled={busy}>
                    <legend>{t(`delivery.${prefix}` as MessageKey)}</legend>
                    {["name", "email", "phone", "address", "state"]
                      .filter(
                        (key) =>
                          prefix !== "pickup" ||
                          staff ||
                          (data.order.pickupContactAvailable === true &&
                            ["FUNDED", "DELIVERED", "COMPLETED"].includes(data.order.status)) ||
                          !["phone", "email"].includes(key) ||
                          (key === "email" && data.order.pickupEmailRequired === true),
                      )
                      .map((key) => (
                        <label key={key}>
                          {t(`delivery.${key}` as MessageKey)}
                          <input
                            name={`${prefix}.${key}`}
                            required
                            readOnly={
                              (prefix === "pickup" &&
                                (key !== "email" || !!data.order.suggestedPickup.email)) ||
                              (prefix === "destination" &&
                                !!savedDestination &&
                                ["address", "state"].includes(key))
                            }
                            type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
                            value={
                              prefix === "pickup" &&
                              (key !== "email" || !!data.order.suggestedPickup.email)
                                ? data.order.suggestedPickup?.[key] || ""
                                : prefix === "destination"
                                  ? key === "address" && savedDestination
                                    ? addressText(savedDestination)
                                    : key === "state" && savedDestination
                                      ? savedDestination.state
                                      : destination[key as keyof Contact] || ""
                                  : undefined
                            }
                            defaultValue={
                              prefix === "pickup" &&
                              key === "email" &&
                              !data.order.suggestedPickup.email
                                ? ""
                                : undefined
                            }
                            onChange={
                              prefix === "destination"
                                ? (e) =>
                                    setDestination((current) => ({
                                      ...current,
                                      [key]: e.target.value,
                                      ...(["address", "state"].includes(key)
                                        ? {
                                            addressId: undefined,
                                            latitude: undefined,
                                            longitude: undefined,
                                          }
                                        : {}),
                                    }))
                                : undefined
                            }
                          />
                        </label>
                      ))}
                  </fieldset>
                ))}
                <label>
                  {say("Digital postcode (optional)")}
                  <input
                    name="destination.postalCode"
                    readOnly={!!savedDestination}
                    disabled={busy}
                    value={savedDestination?.postalCode || destination.postalCode || ""}
                    onChange={(e) =>
                      setDestination((current) => ({ ...current, postalCode: e.target.value }))
                    }
                    maxLength={40}
                  />
                </label>
                <label>
                  {say("Additional directions (optional)")}
                  <textarea
                    name="destination.instructions"
                    readOnly={!!savedDestination}
                    disabled={busy}
                    value={
                      savedDestination
                        ? addressInstructions(savedDestination)
                        : destination.instructions || ""
                    }
                    onChange={(e) =>
                      setDestination((current) => ({ ...current, instructions: e.target.value }))
                    }
                    maxLength={700}
                  />
                </label>
                {data.order.packageSuggestion && (
                  <p>
                    {say(
                      "Calculated from the farmer’s saved shipping details and your order quantity.",
                    )}
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
                      d?.package?.pickupDate ||
                      new Date(Date.now() + 86400000).toISOString().slice(0, 10)
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
                  <textarea
                    name="notes"
                    readOnly
                    value={[packing.notes, packing.pickupInstructions].filter(Boolean).join(" · ")}
                  />
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
                    <p>
                      {say("Provider rating: {rating}/5 ({votes} ratings)", {
                        rating: quote.quality.rating,
                        votes: quote.quality.votes,
                      })}
                    </p>
                  )}
                  <button
                    aria-pressed={d.selectedQuoteId === quote.id}
                    disabled={
                      busy ||
                      dirty ||
                      data.order.checkoutActive ||
                      !quote.available ||
                      !(new Date(quote.expiresAt).getTime() > now) ||
                      d.selectedQuoteId === quote.id
                    }
                    onClick={() => action("/select", { quoteId: quote.id })}
                  >
                    {new Date(quote.expiresAt).getTime() <= now
                      ? t("delivery.expired")
                      : !quote.available
                        ? say("Not available")
                        : d.selectedQuoteId === quote.id
                          ? say("Selected")
                          : t("delivery.select")}
                  </button>
                </article>
              ))}
            {manage &&
              (staff || data.order.isBuyer) &&
              d?.selectedQuoteId &&
              !d?.providerShipmentId &&
              !d?.bookingStartedAt && (
                <button
                  disabled={busy || dirty || data.order.checkoutActive}
                  onClick={() => action("/refresh-quote", {})}
                >
                  {say("Revalidate selected quote")}
                </button>
              )}
            {manage &&
              (staff || data.order.isBuyer) &&
              ["PAID", "BOOKING_BLOCKED"].includes(d?.status) &&
              !d?.bookingStartedAt &&
              data.order.status === "FUNDED" && (
                <button disabled={busy} onClick={() => action("/book", {})}>
                  {t("delivery.book")}
                </button>
              )}
          </>
        )}
        {visible("activity") && (
          <>
             {!tracking && d?.events?.length ? (
              <ol>
                 {d.events.filter((event: any) => !["PROVIDER_CONTACT_UPDATED", "PROVIDER_UPDATE"].includes(event.status)).map((event: any) => (
                  <li key={event.id}>
                    {say(orderUpdateCopy(`status.${event.status}`, data.order.isBuyer).title)} —{" "}
                    {new Date(event.createdAt).toLocaleString()}
                  </li>
                ))}
              </ol>
            ) : (
               !tracking && <p>{say("No activity yet.")}</p>
            )}
          </>
        )}
      </div>
      {staff && d && (manage || staffPermissions.includes("payments.manage")) && (
        <div>
          <h2>Delivery operations</h2>
          <p>These actions use the existing booking and reconciliation safeguards. Tracking refresh does not buy another label or confirm receipt.</p>
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
           {manage && d.status === "MANUAL_REVIEW" && (
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
           {manage && !d.providerShipmentId &&
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
          {manage && d.providerShipmentId && !["CANCELLED", "RETURNED", "BOOKING_UNCERTAIN", "BOOKING_BLOCKED", "BOOKING"].includes(d.status) && <button disabled={busy || !!loadError} onClick={() => action("/reconcile", {})}>
            Queue provider tracking refresh
          </button>}
          {manage && d.status === "BOOKING_UNCERTAIN" && <p className="delivery-warning">Check the existing provider booking and link matching shipment IDs. Do not pay or book again.</p>}
          {manage && d.status === "BOOKING_UNCERTAIN" && !d.parcels?.length && (
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
          {manage && d.status === "BOOKING_UNCERTAIN" &&
            d.parcels
              ?.filter((parcel: any) => ["BOOKING", "BOOKING_UNCERTAIN"].includes(parcel.status))
              .map((parcel: any) => (
                <form
                  key={parcel.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    void action(`/parcels/${parcel.id}/link`, {
                      providerShipmentId: form.get("providerShipmentId"),
                      reason: form.get("reason"),
                    });
                  }}
                >
                  <h3>{say("Parcel {number}", { number: parcel.parcelIndex + 1 })}</h3>
                  <label>
                    Verified provider shipment ID
                    <input name="providerShipmentId" required />
                  </label>
                  <label>
                    Matching evidence and reason
                    <input name="reason" minLength={10} required />
                  </label>
                  <button disabled={busy || !manage}>Link existing parcel shipment</button>
                </form>
              ))}
          {staffPermissions.includes("payments.manage") &&
            data.staffContext?.fundsProvider !== "bachs" &&
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
          {manage && d.providerShipmentId && !d.cancelRequestedAt && !["DELIVERED", "CANCELLED", "RETURNED"].includes(d.status) && (
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
          {d.cancelRequestedAt && <p className="delivery-warning">Cancellation was requested. Reconciliation is pending; no refund is implied and the request must not be repeated.</p>}
        </div>
      )}
      {staff && data.legacyShipment && <section>
        <h2>Legacy manual shipment</h2>
        <p>{data.legacyShipment.carrier} · {data.legacyShipment.trackingRef} · {financeLabel(data.legacyShipment.status)}</p>
        <p>{data.legacyShipment.evidence || "No delivery evidence recorded."}</p>
        <p>A legacy staff delivery record is not a new buyer receipt acknowledgment.</p>
        <Link href={`/admin/logistics?legacy=1&id=${data.legacyShipment.id}`}>Open legacy shipment controls</Link>
      </section>}
      {loadError && <p role="alert">{loadError}{staff && data.observedAt ? ` Showing the snapshot loaded at ${financeDate(data.observedAt)}.` : ""}</p>}
      <p role="status">{notice}</p>
    </section>
  );
}
