import { Select } from "../components/Select";
import { nigeriaStates } from "../lib/locations";
import { LocalizedText as Text } from "../localization";
import React, { useState } from "react";
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
    [error, setError] = useState("");
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
            (!d || ["QUOTED", "PAYMENT_PENDING", "MANUAL_REVIEW"].includes(d.status)) && (
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
      weightKg: "",
      length: "",
      width: "",
      height: "",
      pickupDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      handling: "STANDARD",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Page
      title="Delivery quote"
      back={a.back}
      loading={r.loading}
      footer={
        <Button
          title={busy ? "Checking couriers…" : "Get delivery quotes"}
          disabled={busy || !r.data}
          onPress={async () => {
            setBusy(true);
            setError("");
            try {
              const p = r.data!.order.suggestedPickup;
              await api(`/orders/${a.route.id}/delivery/quotes`, {
                method: "POST",
                body: {
                  pickup: { ...p, email: p.email || pickupEmail, country: "NG" },
                  destination,
                  parcel: {
                    ...parcel,
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
              setBusy(false);
            }
          }}
        />
      }
    >
      <Heading>Where should it go?</Heading>
      <Notice text="Only eligible produce parcels can be booked. Bulk, cold-chain and unsupported routes go to staff review." />
      {r.data && (
        <Card>
          <Label style={{ fontFamily: "NotoBold" }}>Pickup · farmer’s saved address</Label>
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
      <Text style={s.sectionTitle}>Package details</Text>
      <Card>
        {(["weightKg", "length", "width", "height", "pickupDate"] as const).map((k) => (
          <Field
            key={k}
            label={
              {
                weightKg: "Weight (kg)",
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
        ))}
      </Card>
      <Label style={{ fontFamily: "NotoBold" }}>Handling requirements</Label>
      {["STANDARD", "PERISHABLE", "COLD_CHAIN", "BULK"].map((v) => (
        <Pressable
          key={v}
          onPress={() => setParcel((p) => ({ ...p, handling: v }))}
          style={[s.choice, parcel.handling === v && s.selected]}
        >
          <Label>{a.status(v)}</Label>
        </Pressable>
      ))}
      {(error || r.error) && <Notice text={error || r.error} error />}
    </Page>
  );
}
