import { OrderPayment } from "../components/order-payment";
import { Select } from "../components/Select";
import { nigeriaStates } from "../lib/locations";
import { LocalizedText as Text } from "../localization";
import React, { useEffect, useRef, useState } from "react";
import { View, Pressable, Linking } from "react-native";
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
export function Delivery() {
  const a = useApp(),
    r = useResource<DeliveryData>(`/orders/${a.route.id}/delivery`),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [changePickup, setChangePickup] = useState(false),
    [pickupAddressId, setPickupAddressId] = useState("");
  const data = r.data,
    d = data?.delivery;
  const run = async (path: string) => {
    setBusy(true);
    setError("");
    try {
      await api(`/orders/${a.route.id}/delivery/${path}`, { method: "POST", body: {} });
      await r.reload();
    } catch (e) {
      setError(a.error(e));
    } finally {
      setBusy(false);
    }
  };
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
            {d?.selectedQuoteId && (
              <View style={s.between}>
                <Label style={{ fontFamily: "NotoBold" }}>Produce + delivery</Label>
                <Label style={{ fontFamily: "NotoBold" }}>
                  {money((BigInt(data.order.totalMinor) + BigInt(d.shippingMinor)).toString())}
                </Label>
              </View>
            )}
            <Label muted style={s.small}>
              Produce and shipping are accounted for separately.
            </Label>
          </Card>
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
                    busy || new Date(q.expiresAt) <= new Date() || d.selectedQuoteId === q.id
                  }
                  secondary
                  onPress={async () => {
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
            d.quotes.some(
              (q) => q.id === d.selectedQuoteId && new Date(q.expiresAt) <= new Date(),
            ) && (
              <>
                <Notice text={a.t("delivery.expired")} />
                <Button
                  title="Revalidate selected quote"
                  disabled={busy}
                  secondary
                  onPress={() => void run("refresh-quote")}
                />
              </>
            )}
          {d?.status === "MANUAL_REVIEW" && <Notice text={a.t("delivery.manual")} />}
          <Notice text={a.t("delivery.payment")} />
          {data.order.isBuyer &&
            data.order.status === "FUNDED" &&
            d?.status === "PAYMENT_PENDING" && (
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
          {d?.status === "DELIVERED" && data.order.isBuyer && data.order.status === "FUNDED" && (
            <Button
              title={a.t("delivery.confirm")}
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
                        setBusy(true);
                        try {
                          await api(`/marketplace/orders/${data.order.id}/cancel`, {
                            method: "POST",
                          });
                          await r.reload();
                        } catch (e) {
                          setError(a.error(e));
                        } finally {
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
    if (!r.data || initialized.current === r.data.order.id) return;
    initialized.current = r.data.order.id;
    const saved = r.data.delivery?.package;
    const suggested = r.data.order.packageSuggestion;
    const source = saved || suggested;
    if (source)
      setParcel((current) => ({
        ...current,
        weightKg: String(source.weightKg),
        packageCount: String(source.packageCount || 1),
        length: source.length == null ? "" : String(source.length),
        width: source.width == null ? "" : String(source.width),
        height: source.height == null ? "" : String(source.height),
        handling: source.handling,
        notes: source.notes || "",
        ...(saved ? { pickupDate: saved.pickupDate } : {}),
      }));
    if (r.data.delivery?.destination) setDestination(r.data.delivery.destination);
  }, [r.data]);
  return (
    <Page
      title="Delivery quote"
      back={a.back}
      loading={r.loading}
      footer={
        <Button
          title={busy ? "Checking couriers…" : "Get delivery quotes"}
          disabled={busy || !r.data}
          loading={busy}
          onPress={async () => {
            if (submitting.current) return;
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
              const p = r.data!.order.suggestedPickup;
              await api(`/orders/${a.route.id}/delivery/quotes`, {
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
              a.back();
            } catch (e) {
              setError(a.error(e));
            } finally {
              submitting.current = false;
              setBusy(false);
            }
          }}
        />
      }
    >
      {(error || r.error) && <Notice text={error || r.error} error />}
      <Heading>Where should it go?</Heading>
      <Notice text="Only eligible produce parcels can be booked. Bulk, cold-chain and unsupported routes go to staff review." />
      {r.data && (
        <Card>
          <Label style={{ fontFamily: "NotoBold" }}>Pickup · farmer’s confirmed address</Label>
          <Label>
            {r.data.order.suggestedPickup.address}, {r.data.order.suggestedPickup.state}
          </Label>
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
      <Text style={s.sectionTitle}>Your saved addresses</Text>
      <View style={{ gap: 8 }}>
        {a.user?.addresses.map((ad) => (
          <Pressable
            key={ad.id}
            onPress={() =>
              setDestination((d) => ({ ...d, address: `${ad.line1}, ${ad.city}`, state: ad.state }))
            }
          >
            <Card>
              <Label>
                {ad.label} · {ad.line1}, {ad.state}
              </Label>
            </Card>
          </Pressable>
        ))}
      </View>
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
            autoCapitalize={k === "email" ? "none" : "sentences"}
            keyboardType={k === "phone" ? "phone-pad" : k === "email" ? "email-address" : "default"}
            onChangeText={(v) => setDestination((d) => ({ ...d, [k]: v }))}
          />
        ))}
        <Select
          label="State"
          value={destination.state}
          options={nigeriaStates}
          onChange={(state) => setDestination((d) => ({ ...d, state }))}
        />
      </Card>
      {r.data?.order.packageSuggestion && (
        <Card>
          <Label style={{ fontFamily: "NotoBold" }}>Farmer’s packing estimate</Label>
          <Label>{a.status(r.data.order.packageSuggestion.handling)}</Label>
          <Label>
            {a.ui("{count} parcels · estimated packed weight {weight} kg", {
              count: r.data.order.packageSuggestion.packageCount,
              weight: r.data.order.packageSuggestion.weightKg,
            })}
          </Label>
          <Label muted>
            Weight assumes full packages, including a partly filled last package. Review it before
            requesting a quote.
          </Label>
          {r.data.order.packageSuggestion.needsPackedDimensions && (
            <Notice text="Enter the dimensions of the final packed shipment. Separate parcels need staff review; dimensions are not multiplied automatically." />
          )}
          {!!r.data.order.packageSuggestion.farmer.notes && (
            <Label>{r.data.order.packageSuggestion.farmer.notes}</Label>
          )}
        </Card>
      )}
      {!r.data?.order.packageSuggestion && (
        <Notice text="The farmer has not provided packing measurements. Confirm them with the farmer before requesting delivery." />
      )}
      <Text style={s.sectionTitle}>Package details</Text>
      <Card>
        {(["packageCount", "weightKg", "length", "width", "height", "pickupDate"] as const).map(
          (k) => (
            <Field
              key={k}
              label={
                {
                  packageCount: "Final parcel count",
                  weightKg: "Total packed weight (kg)",
                  length: "Length (cm)",
                  width: "Width (cm)",
                  height: "Height (cm)",
                  pickupDate: "Pickup date · YYYY-MM-DD",
                }[k]
              }
              keyboardType={k === "pickupDate" ? "default" : "decimal-pad"}
              value={parcel[k]}
              onChangeText={(v) => setParcel((p) => ({ ...p, [k]: v }))}
            />
          ),
        )}
      </Card>
      <Field
        label="Handling instructions"
        value={parcel.notes}
        multiline
        maxLength={500}
        onChangeText={(notes) => setParcel((p) => ({ ...p, notes }))}
      />
      <Label muted>
        Edits apply to this order and require a new quote. They do not change the farmer’s listing.
      </Label>
      <Label style={{ fontFamily: "NotoBold" }}>Handling requirements</Label>
      {["STANDARD", "PERISHABLE", "COLD_CHAIN", "BULK"].map((v) => {
        const required = r.data?.order.packageSuggestion?.handling;
        const allowed =
          !required ||
          required === "STANDARD" ||
          v === required ||
          (required === "PERISHABLE" && v === "COLD_CHAIN");
        return (
          <Pressable
            key={v}
            accessibilityRole="radio"
            accessibilityState={{ selected: parcel.handling === v, disabled: busy || !allowed }}
            disabled={busy || !allowed}
            onPress={() => setParcel((p) => ({ ...p, handling: v }))}
            style={[s.choice, parcel.handling === v && s.selected, !allowed && { opacity: 0.4 }]}
          >
            <Label>{a.status(v)}</Label>
          </Pressable>
        );
      })}
    </Page>
  );
}
