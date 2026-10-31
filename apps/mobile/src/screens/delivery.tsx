import { saleUnitLabel } from "../../../../packages/contracts/src/sale-packaging";
import { checkoutAddress } from "../lib/checkout-address";
import { postcodeStatus } from "../../../../packages/contracts/src/addresses";
import { OrderDisputes } from "../components/order-disputes";
import { OrderPayment } from "../components/order-payment";
import { Select } from "../components/Select";
import { nigeriaStates } from "../lib/locations";
import { LocalizedText as Text } from "../localization";
import React, { useEffect, useRef, useState } from "react";
import { View, Pressable, Linking, StyleSheet } from "react-native";
import { useApp, useResource } from "../state";
import {
  Page,
  Heading,
  Label,
  Field,
  Button,
  Card,
  Notice,
  Icon,
  s,
  colors,
} from "../components/ui";
import { api } from "../lib/api";
import { money, safeHttps, type DeliveryData, type Contact } from "../lib/domain";

function CheckoutHeader({ title, step, back }: { title: string; step?: string; back: () => void }) {
  return (
    <View style={checkout.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={back}
        hitSlop={14}
      >
        <Icon name="back" size={22} />
      </Pressable>
      <Label style={checkout.headerTitle}>{step || title}</Label>
      <View style={{ width: 22 }}>{!step && <Label style={checkout.info}>ⓘ</Label>}</View>
    </View>
  );
}

function BuyerCheckout({ data, reload }: { data: DeliveryData; reload: () => Promise<unknown> }) {
  const a = useApp();
  const [stage, setStage] = useState<"address" | "scope" | "carrier" | "summary" | "review">(
    a.route.query === "delivery-review" || data.delivery?.status === "MANUAL_REVIEW"
      ? "review"
      : data.order.checkoutActive
        ? "summary"
      : a.route.query === "delivery-carriers"
        ? "carrier"
        : data.delivery?.status === "PICKUP_PENDING"
          ? "summary"
          : data.delivery?.quotes.length
            ? "carrier"
            : "scope",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);
  const d = data.delivery;
  const address =
    a.user?.addresses.find((candidate) => candidate.isDefaultDelivery) || a.user?.addresses[0];
  const collection = d?.status === "PICKUP_PENDING";
  const selected = d?.quotes.find((quote) => quote.id === d.selectedQuoteId);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const currentQuote = !!selected?.available && data.order.checkoutReady && new Date(selected.expiresAt).getTime() > now;
  const total = data.order.payableMinor;
  const paymentRevision = `${d?.selectedQuoteId}:${d?.status}:${d?.shippingMinor}:${data.order.checkoutReady}`;
  useEffect(() => {
    if (
      stage === "review" &&
      d?.status !== "MANUAL_REVIEW" &&
      d?.quotes.some((quote) => quote.available && new Date(quote.expiresAt).getTime() > Date.now())
    )
      setStage("carrier");
  }, [stage, d]);
  const selectQuote = async (quoteId: string) => {
    const quote = d?.quotes.find((candidate) => candidate.id === quoteId);
    if (running.current || data.order.checkoutActive || !quote?.available || !(new Date(quote.expiresAt).getTime() > Date.now())) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await api(`/orders/${data.order.id}/delivery/select`, { method: "POST", body: { quoteId } });
      await reload();
    } catch (e) {
      setError(a.error(e));
      await reload().catch(() => {});
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  if (stage === "review")
    return (
      <Page
        header={<CheckoutHeader title="Delivery review" back={a.back} />}
        contentStyle={checkout.body}
      >
        <Heading>Delivery review pending</Heading>
        <Notice text="Your delivery details are saved. This shipment needs staff review before a delivery price can be confirmed." />
        <Card>
          <Label style={{ fontFamily: "NotoBold" }}>Pickup Location</Label>
          <Label>
            {data.order.suggestedPickup.address}, {data.order.suggestedPickup.state}
          </Label>
          <Label style={{ fontFamily: "NotoBold" }}>Delivery Destination</Label>
          <Label>
            {d?.destination?.address}, {d?.destination?.state}
          </Label>
        </Card>
        <Button
          title="Refresh orders"
          secondary
          onPress={async () => {
            await reload();
          }}
        />
        <Button
          title="Edit delivery details"
          secondary
          onPress={() => a.go("quotes", data.order.id)}
        />
      </Page>
    );
  if (stage === "address")
    return (
      <Page
        header={
          <CheckoutHeader title="Delivery" step="Step 2 of 3" back={() => setStage("scope")} />
        }
        contentStyle={checkout.body}
        footer={
          <Button
            title="Continue"
            disabled={!address}
            onPress={() => a.go("quotes", data.order.id)}
          />
        }
      >
        <Heading>Delivery</Heading>
        <Label muted>Shipping cost is shown before you pay.</Label>
        <View style={s.between}>
          <Label style={checkout.overline}>DESTINATION ADDRESS</Label>
          <Pressable onPress={() => a.go("addresses")}>
            <Label style={s.link}>Change</Label>
          </Pressable>
        </View>
        <Card style={checkout.selectedAddress}>
          <View style={{ flex: 1, gap: 7 }}>
            <View style={s.between}>
              <Label style={checkout.addressName}>
                {a.user?.profile?.fullName || "Delivery contact"}
              </Label>
              <Label style={s.badge}>{address?.label || "Home"}</Label>
            </View>
            <Label style={checkout.addressLine}>{address?.line1 || "Add a delivery address"}</Label>
            <Label muted>
              {address
                ? `${address.city}, ${address.state} State`
                : "Choose an address to continue"}
            </Label>
            <Label muted>{a.user?.phoneE164}</Label>
            {address?.postalCode && <Label>{address.postalCode}</Label>}
            {address && <Label muted>{a.ui(postcodeStatus(address))}</Label>}
          </View>
          <View style={checkout.check}>
            <Label style={{ color: "white", fontFamily: "NotoBold" }}>✓</Label>
          </View>
        </Card>
        <Card style={checkout.softCard}>
          <View style={s.between}>
            <Label muted>Items</Label>
            <Label style={checkout.strong}>
              {data.order.quantity || 1}{" "}
              {saleUnitLabel(data.order.salePackaging, a.ui) ||
                a.unit(data.order.unitCode || "UNIT")}{" "}
              {data.order.title}
            </Label>
          </View>
          <View style={s.between}>
            <Label muted>Farmer depot</Label>
            <Label style={checkout.strong}>{data.order.suggestedPickup.state}</Label>
          </View>
          <View style={checkout.rule} />
          <View style={s.between}>
            <Label muted>Produce subtotal</Label>
            <Label style={checkout.gold}>{money(data.order.totalMinor)}</Label>
          </View>
        </Card>
        <Card style={checkout.note}>
          <Icon name="cartShield" size={22} />
          <Label style={{ flex: 1, fontSize: 14 }}>
            Inter-state transit via verified logistics partners. You review freight costs before
            payment.
          </Label>
        </Card>
      </Page>
    );
  if (stage === "scope")
    return (
      <Page
        header={<CheckoutHeader title="Pickup or delivery?" step="STEP 1 OF 3" back={a.back} />}
        contentStyle={checkout.body}
      >
        <Label style={checkout.flowBadge}>Logistics & fulfillment</Label>
        <Heading>Pickup or delivery?</Heading>
        <Label>Choose how you want to receive your produce.</Label>
        <Pressable
          accessibilityRole="button"
          disabled={busy || data.order.checkoutActive}
          onPress={async () => {
            if (running.current || data.order.checkoutActive) return;
            running.current = true;
            setBusy(true);
            setError("");
            try {
              await api(`/orders/${data.order.id}/delivery/collection`, {
                method: "POST",
                body: {},
              });
              await reload();
              setStage("summary");
            } catch (e) {
              setError(a.error(e));
            } finally {
              running.current = false;
              setBusy(false);
            }
          }}
        >
          <Card style={checkout.option}>
            <View style={{ flex: 1 }}>
              <Label style={checkout.optionTitle}>Pickup</Label>
              <Label>Collect at the farmer’s confirmed address. No courier fee.</Label>
            </View>
            <View style={checkout.radio} />
          </Card>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy || data.order.checkoutActive} onPress={() => setStage("address")}>
          <Card style={checkout.option}>
            <View style={{ flex: 1 }}>
              <Label style={checkout.optionTitle}>Delivery</Label>
              <Label>
                Send to your saved address. Courier coverage and fees depend on your location.
              </Label>
            </View>
            <View style={checkout.radio} />
          </Card>
        </Pressable>
        {error && <Notice text={error} error />}
      </Page>
    );
  if (stage === "carrier")
    return (
      <Page
        header={
          <CheckoutHeader
            title={`To ${d?.destination?.state || address?.city || "destination"}`}
            back={() => setStage("scope")}
          />
        }
        contentStyle={checkout.body}
        footer={
          <Button
            title="Continue"
            disabled={(!currentQuote && !data.order.checkoutActive) || busy}
            onPress={() => setStage("summary")}
          />
        }
      >
        <Label style={checkout.routeLabel}>NATIONWIDE DELIVERY</Label>
        <Heading>To {d?.destination?.state || address?.city}</Heading>
        <Card style={checkout.softCard}>
          <Label style={checkout.strong}>
            {data.order.title} from {data.order.suggestedPickup.state}
          </Label>
          <Label muted>
            {data.order.suggestedPickup.state} → {d?.destination?.state || address?.state}
          </Label>
        </Card>
        <View style={s.between}>
          <Label style={checkout.optionTitle}>Available Carriers</Label>
          <Label style={{ color: colors.green }}>{d?.quotes.filter((quote) => quote.available && new Date(quote.expiresAt).getTime() > now).length || 0} best match</Label>
        </View>
        {d?.quotes.map((quote) => {
          const active = quote.id === d.selectedQuoteId;
          const valid = quote.available && new Date(quote.expiresAt).getTime() > now;
          return (
            <Pressable
              key={quote.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled: busy || data.order.checkoutActive || !valid }}
              disabled={busy || data.order.checkoutActive || active || !valid}
              onPress={() => void selectQuote(quote.id)}
            >
              <Card style={{ ...checkout.carrier, ...(active ? checkout.optionSelected : {}) }}>
                {quote.recommended && <Label style={checkout.recommended}>⚡ RECOMMENDED</Label>}
                {!!quote.recommendationReason && (
                  <Label muted>{a.ui(quote.recommendationReason)}</Label>
                )}
                <View style={s.between}>
                  <View style={{ flex: 1 }}>
                    <Label style={checkout.carrierName}>{quote.courier}</Label>
                    <Label>
                      <Label style={checkout.gold}>{money(quote.amountMinor)}</Label>
                      {quote.eta ? `  ·  ${quote.eta}` : ""}
                    </Label>
                  </View>
                  {active ? (
                    <View style={checkout.check}>
                      <Label style={{ color: "white" }}>✓</Label>
                    </View>
                  ) : (
                    <View style={checkout.radio} />
                  )}
                </View>

                {quote.quality?.rating != null && quote.quality.votes > 0 && (
                  <Label muted>
                    {a.ui("Provider rating: {rating}/5 ({votes} ratings)", {
                      rating: quote.quality.rating,
                      votes: quote.quality.votes,
                    })}
                  </Label>
                )}
                {quote.quality?.trackingLevel != null && (
                  <Label muted>
                    {a.ui("Tracking quality: {level}/10", { level: quote.quality.trackingLevel })}
                  </Label>
                )}
                <Label style={checkout.strong}>◷ Estimated arrival</Label>
                <Label>{quote.eta || "Confirmed after booking"}</Label>
                <Label muted>
                  {new Date(quote.expiresAt).getTime() <= now
                    ? "Quote expired"
                    : !quote.available ? a.ui("Not available")
                    : a.ui("Valid until {date}", { date: a.date(quote.expiresAt) })}
                </Label>
              </Card>
            </Pressable>
          );
        })}
        <Card style={checkout.guarantee}>
          <Icon name="cartShield" size={22} />
          <View style={{ flex: 1 }}>
            <Label style={checkout.strong}>LeetLogic Guarantee</Label>
            <Label>Tracked in real time with delivery confirmation.</Label>
          </View>
        </Card>
        <Button
          title="Get fresh delivery quotes"
          secondary
          disabled={busy || data.order.checkoutActive}
          onPress={() => a.go("quotes", data.order.id)}
        />
        {error && <Notice text={error} error />}
      </Page>
    );
  return (
    <Page
      header={
        <CheckoutHeader
          title="Order summary"
          back={() => setStage(collection ? "scope" : "carrier")}
        />
      }
      contentStyle={checkout.body}
      footer={
        collection || currentQuote || data.order.checkoutActive ? (
          <OrderPayment
            orderId={data.order.id}
            isBuyer
            onChanged={reload}
            compact
            buttonTitle="Make Payment"
            revision={paymentRevision}
            disabled={busy}
          />
        ) : (
          <View style={{ gap: 10 }}>
            <Notice text={a.error({ code: data.order.checkoutErrorCode || "QUOTE_EXPIRED" })} />
            <Button
              title="Get fresh delivery quotes"
              onPress={() => a.go("quotes", data.order.id)}
            />
          </View>
        )
      }
    >
      {!collection && (
        <Card style={checkout.softCard}>
          <Label>🏅 Delivering to: {a.user?.profile?.fullName || "Buyer"} · Change</Label>
          <Label muted>
            {d?.destination
              ? `${d.destination.address}, ${d.destination.state}`
              : "Choose a delivery destination"}
          </Label>
          <Label>
            {d?.destination?.name} · {d?.destination?.phone}
          </Label>
          <Button title="Edit delivery details" secondary disabled={busy || data.order.checkoutActive} onPress={() => a.go("quotes", data.order.id)} />
        </Card>
      )}
      {collection && (
        <Card>
          <Heading>Pickup</Heading>
          <Label>
            {data.order.suggestedPickup.address}, {data.order.suggestedPickup.state}
          </Label>
          <Label>{data.order.suggestedPickup.phone}</Label>
          <Label>Call the farmer to arrange collection after payment.</Label>
          <Button
            title="Call farmer"
            secondary
            onPress={() =>
              void Linking.openURL(`tel:${data.order.suggestedPickup.phone}`).catch((e) =>
                setError(a.error(e)),
              )
            }
          />
        </Card>
      )}
      <Card style={checkout.productSummary}>
        <Label style={checkout.flowBadge}>• Active</Label>
        <Heading>{data.order.title}</Heading>
        <Label style={checkout.priceLarge}>{money(data.order.totalMinor)}</Label>
        <Label muted>
          {data.order.suggestedPickup.state} · {data.order.quantity || 1}{" "}
          {saleUnitLabel(data.order.salePackaging, a.ui) || a.unit(data.order.unitCode || "UNIT")}
        </Label>
      </Card>
      <Card style={checkout.paymentDetails}>
        <Label style={checkout.optionTitle}>Payment details</Label>
        <View style={s.between}>
          <Label muted>Produce</Label>
          <Label>{money(data.order.totalMinor)}</Label>
        </View>
        <View style={s.between}>
          <Label muted>{collection ? "Pickup" : "Delivery"}</Label>
          <Label>{collection ? money("0") : currentQuote ? money(d!.shippingMinor) : a.ui("Not quoted")}</Label>
        </View>
        <View style={checkout.rule} />
        <View style={s.between}>
          <Label>Total</Label>
          <Label style={checkout.strong}>{total && (collection || currentQuote) ? money(total) : a.ui("Not available")}</Label>
        </View>
        <Label style={{ fontSize: 14 }}>Payment provider fees are shown before confirmation.</Label>
      </Card>
      <Card style={checkout.note}>
        <Icon name="cartShield" size={22} />
        <View style={{ flex: 1 }}>
          <Label style={checkout.strong}>Secure payment</Label>
          <Label muted>Payment held safely until you inspect and confirm receipt.</Label>
        </View>
      </Card>
      {error && <Notice text={error} error />}
      {!collection && <Label style={checkout.liveBadge}>Live hub routing active</Label>}
      {!collection && (
        <Label>
          {data.order.suggestedPickup.state} → {d?.destination?.state || address?.state}
        </Label>
      )}
    </Page>
  );
}
export function Delivery() {
  const a = useApp(),
    r = useResource<DeliveryData>(`/orders/${a.route.id}/delivery`),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [changePickup, setChangePickup] = useState(false),
    [pickupAddressId, setPickupAddressId] = useState("");
  const data = r.data,
    d = data?.delivery;
  const running = useRef(false);
  const run = async (path: string) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await api(`/orders/${a.route.id}/delivery/${path}`, { method: "POST", body: {} });
      await r.reload();
    } catch (e) {
      setError(a.error(e));
      await r.reload().catch(() => {});
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  if (data?.order.isBuyer && data.order.status === "AWAITING_PAYMENT")
    return <BuyerCheckout data={data} reload={r.reload} />;
  return (
    <Page
      title={
        data ? a.ui("Order · {reference}", { reference: data.order.reference.slice(-8) }) : "Order"
      }
      back={a.back}
      loading={r.loading}
    >
      {r.error && <Notice text={r.error} error />}
      {data && (
        <>
          <Card>
            <Text style={s.badge}>{a.status(data.order.status)}</Text>
            <Heading>{data.order.title}</Heading>
            <View style={s.between}>
              <Label muted>{a.t("orders.produce")}</Label>
              <Label>{money(data.order.totalMinor)}</Label>
            </View>
            <View style={s.between}>
              <Label muted>{a.t("orders.delivery")}</Label>
              <Label>
                {d && (d.selectedQuoteId || d.paidMinor !== "0")
                  ? money(d?.shippingMinor)
                  : "Not quoted"}
              </Label>
            </View>
            {data.order.totalWithDeliveryMinor && (
              <View style={s.between}>
                <Label style={{ fontFamily: "NotoBold" }}>Produce + delivery</Label>
                <Label style={{ fontFamily: "NotoBold" }}>
                  {money(data.order.totalWithDeliveryMinor)}
                </Label>
              </View>
            )}
            <Label muted style={s.small}>
              Produce and shipping are accounted for separately.
            </Label>
          </Card>
          {data.order.isBuyer && d?.status === "PICKUP_READY" && (
            <Card>
              <Heading>Pickup</Heading>
              <Label>Payment received. Arrange collection with the farmer.</Label>
              <Label>{data.order.suggestedPickup.phone}</Label>
              <Button
                title="Call farmer"
                secondary
                onPress={() =>
                  void Linking.openURL(`tel:${data.order.suggestedPickup.phone}`).catch((e) =>
                    setError(a.error(e)),
                  )
                }
              />
            </Card>
          )}
          {!data.order.isBuyer && d?.destination?.phone && (
            <Card>
              <Heading>Buyer contact</Heading>
              <Label>{d.destination.name}</Label>
              <Label>{d.destination.phone}</Label>
              <Button
                title="Call buyer"
                secondary
                onPress={() =>
                  void Linking.openURL(`tel:${d.destination.phone}`).catch((e) =>
                    setError(a.error(e)),
                  )
                }
              />
            </Card>
          )}
          {data.order.isBuyer && <OrderDisputes orderId={a.route.id!} />}
          <Card>
            <Heading>Pickup location</Heading>
            <Label>
              {data.order.suggestedPickup.address}, {data.order.suggestedPickup.state}
            </Label>
            {data.order.suggestedPickup.latitude != null &&
              data.order.suggestedPickup.longitude != null && (
                <Button
                  title="View pickup on map"
                  secondary
                  onPress={() => {
                    void Linking.openURL(
                      `https://www.google.com/maps/search/?api=1&query=${data.order.suggestedPickup.latitude},${data.order.suggestedPickup.longitude}`,
                    ).catch(() => setError(a.ui("The map could not be opened. Please try again.")));
                  }}
                />
              )}
            {!data.order.isBuyer &&
              data.order.status === "AWAITING_PAYMENT" &&
              (!d || d.paidMinor === "0") && (
                <>
                  <Button
                    title="Use a different pickup address"
                    secondary
                    disabled={busy}
                    onPress={() => setChangePickup(!changePickup)}
                  />
                  {changePickup && (
                    <>
                      <Select
                        label="Pickup address"
                        value={pickupAddressId}
                        options={(a.user?.addresses || []).map((address) => ({
                          value: address.id,
                          label: `${address.id === a.user?.farmerProfile?.primaryAddressId ? a.ui("Farm location") : address.label} · ${address.line1}, ${address.city}`,
                        }))}
                        onChange={setPickupAddressId}
                        disabled={busy}
                      />
                      <Button
                        title="Save pickup address"
                        loading={busy}
                        disabled={busy || !pickupAddressId}
                         onPress={async () => {
                           if (running.current) return;
                           running.current = true;
                          setBusy(true);
                          setError("");
                          try {
                            await api(`/orders/${a.route.id}/delivery/pickup`, {
                              method: "POST",
                              body: { addressId: pickupAddressId },
                            });
                            await r.reload();
                            setChangePickup(false);
                          } catch (e) {
                            setError(a.error(e));
                           } finally {
                             running.current = false;
                            setBusy(false);
                          }
                        }}
                      />
                      <Button
                        title="Add a different pickup address"
                        secondary
                        disabled={busy}
                        onPress={() => a.go("addresses", "pickup")}
                      />
                      <Label muted>
                        Changing pickup clears delivery quotes. The buyer will need a new quote
                        before payment.
                      </Label>
                    </>
                  )}
                </>
              )}
          </Card>
          {d?.package && (
            <Card>
              <Heading>Package details</Heading>
              <Label>
                {a.ui("Final parcel count")}: {d.package.packageCount || 1}
              </Label>
              <Label>
                {a.ui("Total packed weight (kg)")}: {d.package.weightKg}
              </Label>
              <Label>
                {a.ui("Package size: {length} × {width} × {height} cm", {
                  length: d.package.length,
                  width: d.package.width,
                  height: d.package.height,
                })}
              </Label>
              <Label>{a.status(d.package.handling)}</Label>
              {!!d.package.notes && <Label>{d.package.notes}</Label>}
            </Card>
          )}
          <OrderPayment
            orderId={a.route.id!}
            isBuyer={data.order.isBuyer}
            topup={d?.status === "TOPUP_REQUIRED"}
            onChanged={r.reload}
            revision={`${d?.selectedQuoteId}:${d?.status}:${d?.shippingMinor}:${data.order.checkoutReady}`}
            disabled={busy}
          />
          {d && (
            <Card>
              <View style={s.row}>
                <Icon name="truck" />
                <Text style={s.sectionTitle}>{a.t("delivery.title")}</Text>
              </View>
              <Text style={s.badge}>{a.status(d.status)}</Text>
              {d.courier && <Label>{d.courier}</Label>}
              {d.destination?.address && (
                <Label muted>
                  {d.destination.address}, {d.destination.state}
                </Label>
              )}
              {d.parcels?.map((parcel) => (
                <View key={parcel.id} style={{ gap: 8 }}>
                  <Label>
                    {a.ui("Parcel {number}", { number: parcel.parcelIndex + 1 })}:{" "}
                    {a.status(parcel.status)}
                  </Label>
                  {parcel.trackingUrl && safeHttps(parcel.trackingUrl) && (
                    <Button
                      title="Track with courier"
                      secondary
                      onPress={() => void Linking.openURL(parcel.trackingUrl!)}
                    />
                  )}
                </View>
              ))}
              {d.trackingUrl && safeHttps(d.trackingUrl) && (
                <Button
                  title="Track with courier"
                  secondary
                  onPress={() => void Linking.openURL(d.trackingUrl!)}
                />
              )}
            </Card>
          )}
          {data.order.isBuyer &&
            data.order.status === "AWAITING_PAYMENT" &&
            (!d ||
              ["QUOTE_REQUIRED", "QUOTED", "PAYMENT_PENDING", "MANUAL_REVIEW"].includes(
                d.status,
              )) && (
              <Button
                title={a.t("delivery.quotes")}
                onPress={() => a.go("quotes", data.order.id)}
              />
            )}
          {d?.quotes.map((q) => (
            <Card
              key={q.id}
              style={{ borderWidth: d.selectedQuoteId === q.id ? 2 : 0, borderColor: colors.green }}
            >
              <View style={s.between}>
                <Label style={{ fontFamily: "NotoBold" }}>{q.courier}</Label>
                <Label>{money(q.amountMinor)}</Label>
              </View>
              {q.eta && <Label muted>{q.eta}</Label>}
              <Label muted style={s.small}>
                {a.ui("Valid until {date}", { date: a.date(q.expiresAt) })}
              </Label>
              {data.order.isBuyer && data.order.status === "AWAITING_PAYMENT" && (
                <Button
                  title={d.selectedQuoteId === q.id ? "Selected" : a.t("delivery.select")}
                  disabled={
                    busy || data.order.checkoutActive || !q.available || new Date(q.expiresAt) <= new Date() || d.selectedQuoteId === q.id
                  }
                  secondary
                   onPress={async () => {
                     if (running.current || data.order.checkoutActive || !q.available || !(new Date(q.expiresAt).getTime() > Date.now())) return;
                     running.current = true;
                    setBusy(true);
                    try {
                      await api(`/orders/${data.order.id}/delivery/select`, {
                        method: "POST",
                        body: { quoteId: q.id },
                      });
                      await r.reload();
                    } catch (e) {
                      setError(a.error(e));
                     } finally {
                       running.current = false;
                      setBusy(false);
                    }
                  }}
                />
              )}
            </Card>
          ))}
          {data.order.isBuyer &&
            d?.selectedQuoteId &&
            ["AWAITING_PAYMENT", "FUNDED"].includes(data.order.status) &&
             !d.providerShipmentId && !d.bookingStartedAt &&
             d.quotes.some((q) => q.id === d.selectedQuoteId && (!q.available || new Date(q.expiresAt) <= new Date())) && (
              <>
                <Notice text={a.t("delivery.expired")} />
                <Button
                  title="Revalidate selected quote"
                   disabled={busy || data.order.checkoutActive}
                  secondary
                  onPress={() => void run("refresh-quote")}
                />
              </>
            )}
          {d?.status === "MANUAL_REVIEW" && <Notice text={a.t("delivery.manual")} />}
          <Notice text={a.t("delivery.payment")} />
          {data.order.isBuyer &&
            data.order.status === "FUNDED" &&
             ["PAID", "BOOKING_BLOCKED"].includes(d?.status || "") && !d?.bookingStartedAt && (
              <Button
                title={a.t("delivery.book")}
                disabled={busy}
                onPress={() => void run("book")}
              />
            )}
          {d && (
            <Card>
              <Text style={s.sectionTitle}>Shipment timeline</Text>
              <Label muted style={s.small}>
                Carrier events are checked by the server. Delivery does not automatically release
                escrow.
              </Label>
              {d.events.map((e) => (
                <View key={e.id} style={[s.row, { alignItems: "flex-start" }]}>
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: colors.green,
                      marginTop: 6,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Label style={{ fontFamily: "NotoBold" }}>{a.status(e.status)}</Label>
                    <Label muted style={s.small}>
                      {a.date(e.createdAt)}
                    </Label>
                  </View>
                </View>
              ))}
            </Card>
          )}
          {["DELIVERED", "PICKUP_READY"].includes(d?.status || "") &&
            data.order.isBuyer &&
            data.order.status === "FUNDED" && (
              <Button
                title={
                  d?.status === "PICKUP_READY" ? "Confirm pickup received" : a.t("delivery.confirm")
                }
                disabled={busy}
                onPress={() =>
                  a.alert(
                    "Confirm receipt",
                    "Only confirm after inspecting and receiving your produce. Escrow release remains subject to dispute checks.",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "I received it", onPress: () => void run("confirm") },
                    ],
                  )
                }
              />
            )}
          {data.order.isBuyer && data.order.status === "AWAITING_PAYMENT" && (
            <Button
              title="Cancel unpaid order"
              secondary
              disabled={busy}
              onPress={() =>
                a.alert(
                  "Cancel this order?",
                  "The reserved produce will become available again. No payment or refund is processed.",
                  [
                    { text: "Keep order", style: "cancel" },
                    {
                      text: "Cancel order",
                       onPress: async () => {
                         if (running.current) return;
                         running.current = true;
                        setBusy(true);
                        try {
                          await api(`/marketplace/orders/${data.order.id}/cancel`, {
                            method: "POST",
                          });
                          await r.reload();
                        } catch (e) {
                          setError(a.error(e));
                         } finally {
                           running.current = false;
                          setBusy(false);
                        }
                      },
                    },
                  ],
                )
              }
            />
          )}
          <Button
            title={a.t("delivery.refresh")}
            secondary
            disabled={busy}
            onPress={() => void r.reload()}
          />
        </>
      )}
      {error && <Notice text={error} error />}
    </Page>
  );
}

const checkout = StyleSheet.create({
  header: {
    minHeight: 76,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.paper,
  },
  headerTitle: { fontFamily: "NotoBold", fontSize: 18, lineHeight: 26, textAlign: "center" },
  info: { color: colors.green, fontFamily: "NotoBold", fontSize: 18 },
  body: { paddingHorizontal: 24, paddingTop: 20, gap: 24 },
  overline: { fontFamily: "NotoBold", fontSize: 16 },
  selectedAddress: {
    borderWidth: 2,
    borderColor: colors.green,
    backgroundColor: "#f4f9f6",
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
  },
  addressName: { fontFamily: "NotoBold", fontSize: 18, lineHeight: 26 },
  addressLine: { fontSize: 18, lineHeight: 26 },
  check: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  radio: {
    width: 29,
    height: 29,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#d6d0c6",
    backgroundColor: "white",
  },
  softCard: { backgroundColor: "#f2f0ec", borderRadius: 16, gap: 16 },
  strong: { fontFamily: "NotoBold" },
  rule: { height: 1, backgroundColor: colors.line },
  gold: { color: colors.gold, fontFamily: "NotoBold", fontSize: 21 },
  note: { backgroundColor: "#f2f0ec", flexDirection: "row", alignItems: "flex-start", gap: 12 },
  flowBadge: {
    alignSelf: "flex-start",
    color: colors.green,
    backgroundColor: colors.mint,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  option: {
    minHeight: 94,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
  },
  optionSelected: { borderWidth: 2, borderColor: colors.green, backgroundColor: "#f4f9f6" },
  optionTitle: { fontFamily: "NotoBold", fontSize: 18, lineHeight: 26 },
  routeLabel: { color: colors.green, fontFamily: "NotoBold", fontSize: 13, textAlign: "center" },
  carrier: { borderWidth: 1, borderColor: colors.line, gap: 14, overflow: "visible" },
  carrierName: { fontFamily: "NotoBold", fontSize: 21, lineHeight: 30 },
  recommended: {
    alignSelf: "flex-end",
    marginTop: -29,
    color: "white",
    backgroundColor: colors.green,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 3,
    fontFamily: "NotoBold",
    fontSize: 12,
  },
  innerNote: { backgroundColor: "#f2f0ec", borderRadius: 12, padding: 12 },
  guarantee: {
    backgroundColor: "#e4f3e9",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  productSummary: { gap: 8 },
  priceLarge: { color: "#6b4a2f", fontFamily: "Montserrat", fontSize: 25, lineHeight: 35 },
  paymentDetails: { gap: 14 },
  liveBadge: {
    alignSelf: "flex-start",
    color: "#8a5a2f",
    backgroundColor: "#fff0c9",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 14,
  },
});
const empty: Contact = { name: "", phone: "", email: "", address: "", state: "", country: "NG" };
export function Quotes() {
  const a = useApp(),
    r = useResource<DeliveryData>(`/orders/${a.route.id}/delivery`),
    [destination, setDestination] = useState<Contact>({
      ...empty,
      name: a.user?.profile?.fullName || "",
      phone: a.user?.phoneE164 || "",
      email: a.user?.profile?.email || "",
    }),
    [pickupEmail, setPickupEmail] = useState(""),
    [editDestination, setEditDestination] = useState(false),
    [parcel, setParcel] = useState({
      packageCount: "1",
      notes: "",
      weightKg: "",
      length: "",
      width: "",
      height: "",
      pickupDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      handling: "STANDARD",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const initialized = useRef<string | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    if (!r.data) return;
    const firstLoad = initialized.current !== r.data.order.id;
    const saved = r.data.delivery?.package;
    const source = r.data.order.packageSuggestion;
    // Packing is server-owned and may change on a reload. Destination/date edits are local.
    setParcel((current) => ({
      ...current,
      weightKg: source ? String(source.weightKg) : "",
      packageCount: String(source?.packageCount || 1),
      length: source?.length == null ? "" : String(source.length),
      width: source?.width == null ? "" : String(source.width),
      height: source?.height == null ? "" : String(source.height),
      handling: source?.handling || "STANDARD",
      notes: source?.notes || "",
      ...(firstLoad ? { pickupDate: saved?.pickupDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10) } : {}),
    }));
    if (!firstLoad) return;
    initialized.current = r.data.order.id;
    if (r.data.delivery?.destination && r.data.delivery.status !== "PICKUP_PENDING") {
      const savedDestination = a.user?.addresses.find((address) => address.id === r.data!.delivery?.destination.addressId);
      setDestination({ ...r.data.delivery.destination, ...(savedDestination ? checkoutAddress(savedDestination) : {}) });
    }
    else {
      const address =
        a.user?.addresses.find((item) => item.isDefaultDelivery) || a.user?.addresses[0];
      if (address)
        setDestination((current) => ({
          ...current,
           ...checkoutAddress(address),
        }));
    }
  }, [r.data]);
  return (
    <Page
      title="Delivery"
      back={a.back}
      loading={r.loading}
      footer={
        <Button
          title={busy ? "Checking couriers…" : "Continue to delivery options"}
            disabled={busy || r.data?.order.checkoutActive || !r.data?.order.packageSuggestion}
          loading={busy}
          onPress={async () => {
            if (submitting.current || r.data?.order.checkoutActive || !r.data?.order.packageSuggestion) return;
            submitting.current = true;
            setBusy(true);
            setError("");
            try {
              for (const key of [
                "packageCount",
                "weightKg",
                "length",
                "width",
                "height",
              ] as const) {
                if (!/^\d+(\.\d+)?$/.test(parcel[key]) || Number(parcel[key]) <= 0)
                  throw new Error(
                    "Enter a positive parcel count, packed weight and all three dimensions.",
                  );
              }
              if (!Number.isInteger(Number(parcel.packageCount)))
                throw new Error("The number of parcels must be a whole number.");
              if (
                Math.max(Number(parcel.length), Number(parcel.width), Number(parcel.height)) >
                  1000 ||
                Number(parcel.weightKg) > 1_000_000
              )
                throw new Error(
                  "Use positive measurements: dimensions up to 1,000 cm and weight up to 1,000,000 kg.",
                );
              const p = r.data!.order.suggestedPickup;
              const result = await api(`/orders/${a.route.id}/delivery/quotes`, {
                method: "POST",
                body: {
                  pickup: { ...p, email: p.email || pickupEmail, country: "NG" },
                  destination,
                  parcel: {
                    ...parcel,
                    packageCount: Number(parcel.packageCount),
                    weightKg: Number(parcel.weightKg),
                    length: Number(parcel.length),
                    width: Number(parcel.width),
                    height: Number(parcel.height),
                  },
                },
              });
              if (!result.items?.length)
                throw new Error(
                  "No delivery service is available for this shipment and date. Try another date or choose pickup.",
                );
              a.returnTo("delivery", a.route.id, "delivery-carriers");
            } catch (e) {
              setError(a.error(e));
              await r.reload().catch(() => {});
            } finally {
              submitting.current = false;
              setBusy(false);
            }
          }}
        />
      }
    >
      {(error || r.error) && <Notice text={error || r.error} error />}
      <Heading>Review your delivery</Heading>
      <Notice text="Delivery options use the farmer’s saved measurements. Review the full delivery fee before payment." />
      {r.data && (
        <Card>
          <Label style={{ fontFamily: "NotoBold" }}>Pickup Location</Label>
          <Label muted>Farmer’s confirmed pickup address</Label>
          <Label>
            {r.data.order.suggestedPickup.address}, {r.data.order.suggestedPickup.state}
          </Label>
          {r.data.order.suggestedPickup.postalCode && <Label>{r.data.order.suggestedPickup.postalCode}</Label>}
          {r.data.order.suggestedPickup.instructions && <Label muted>{r.data.order.suggestedPickup.instructions}</Label>}
          {!r.data.order.suggestedPickup.email && (
            <Field
              label="Farmer contact email"
              value={pickupEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setPickupEmail}
            />
          )}
        </Card>
      )}
      <Card>
        <Label style={{ fontFamily: "NotoBold" }}>Delivery Destination</Label>
        <Label>
          {destination.address || "Choose a delivery address"}
          {destination.state ? `, ${destination.state}` : ""}
        </Label>
        <Label muted>
          {destination.name} · {destination.phone}
        </Label>
        <Label muted>{destination.email}</Label>
        {destination.postalCode && <Label>{destination.postalCode}</Label>}
        {destination.addressId && <Label muted>{a.ui(postcodeStatus(a.user?.addresses.find((address) => address.id === destination.addressId) || {}))}</Label>}
        {destination.instructions && <Label muted>{destination.instructions}</Label>}
        <Button
          title={editDestination ? "Done" : "Edit delivery details"}
          secondary
          disabled={busy}
          onPress={() => setEditDestination((value) => !value)}
        />
      </Card>
      {(editDestination || !destination.address) && (
        <>
          <Text style={s.sectionTitle}>Your saved addresses</Text>
          <View style={{ gap: 8 }}>
            {a.user?.addresses.map((ad) => (
              <Pressable
                key={ad.id}
                disabled={busy}
                onPress={() =>
                  setDestination((d) => ({
                    ...d,
                     ...checkoutAddress(ad),
                  }))
                }
              >
                <Card>
                  <Label>
                    {ad.label} · {ad.line1}, {ad.state}
                  </Label>
                  {ad.postalCode && <Label>{ad.postalCode}</Label>}
                  <Label muted>{a.ui(postcodeStatus(ad))}</Label>
                </Card>
              </Pressable>
            ))}
          </View>
          <Button title="Add or verify a delivery address" secondary disabled={busy} onPress={() => a.go("addresses")} />
          <Card>
            {(["name", "phone", "email", "address"] as const).map((k) => (
              <Field
                key={k}
                label={
                  {
                    name: "Full name",
                    phone: "Phone",
                    email: "Email",
                    address: "Delivery address",
                    state: "State",
                  }[k]
                }
                value={destination[k]}
                editable={!busy}
                autoCapitalize={k === "email" ? "none" : "sentences"}
                keyboardType={
                  k === "phone" ? "phone-pad" : k === "email" ? "email-address" : "default"
                }
                onChangeText={(v) =>
                  setDestination((d) => ({
                    ...d,
                    [k]: v,
                    ...(k === "address" ? { addressId: undefined, latitude: undefined, longitude: undefined } : {}),
                  }))
                }
              />
            ))}
            <Select
              label="State"
              value={destination.state}
              options={nigeriaStates}
              disabled={busy}
              onChange={(state) =>
                setDestination((d) => ({ ...d, state, addressId: undefined, latitude: undefined, longitude: undefined }))
              }
            />
            {!destination.addressId && <Field label="Additional directions (optional)" value={destination.instructions || ""} maxLength={700} editable={!busy} onChangeText={(instructions) => setDestination((d) => ({ ...d, instructions }))} />}
          </Card>
        </>
      )}
      {!r.data?.order.packageSuggestion && (
        <Notice text="The farmer must complete shipping measurements before delivery is available. You can choose pickup instead." />
      )}
      <Card>
        <Label style={{ fontFamily: "NotoBold" }}>Package details</Label>
        {r.data?.order.packageSuggestion && (
          <Label muted>
            Calculated from the farmer’s saved shipping details and your order quantity.
          </Label>
        )}

        <Label>
          {a.ui("{count} parcels · estimated packed weight {weight} kg", {
            count: parcel.packageCount,
            weight: parcel.weightKg || "—",
          })}
        </Label>
        <Label>
          {a.ui("Per parcel: {length} × {width} × {height} cm", {
            length: parcel.length || "—",
            width: parcel.width || "—",
            height: parcel.height || "—",
          })}
        </Label>
        <Label>{a.status(parcel.handling)}</Label>
        {!!parcel.notes && parcel.notes !== r.data?.order.packageSuggestion?.farmer.notes && (
          <Label>{parcel.notes}</Label>
        )}
        {r.data?.order.packageSuggestion?.farmer.notes && (
          <View style={{ gap: 4 }}>
            <Label style={{ fontFamily: "NotoBold" }}>Farmer’s handling instructions</Label>
            <Label>{r.data.order.packageSuggestion.farmer.notes}</Label>
          </View>
        )}
        {Number(parcel.packageCount) > 1 && (
          <Notice text="Each parcel has its own delivery booking. The displayed fee includes all parcels." />
        )}

        <Label muted>{parcel.pickupDate}</Label>
      </Card>
      <Field
        label="Pickup date · YYYY-MM-DD"
        value={parcel.pickupDate}
        onChangeText={(pickupDate) => setParcel((current) => ({ ...current, pickupDate }))}
      />
    </Page>
  );
}
