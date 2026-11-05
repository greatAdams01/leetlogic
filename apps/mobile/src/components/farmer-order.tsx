import React, { useState } from "react";
import { View, Linking, Pressable, StyleSheet } from "react-native";
import { farmerOrderGuide } from "../../../../packages/contracts/src/farmer-order";
import { orderUpdateCopy } from "../../../../packages/contracts/src/order-updates";
import { saleUnitLabel } from "../../../../packages/contracts/src/sale-packaging";
import { useApp } from "../state";
import { money, safeHttps, type DeliveryData } from "../lib/domain";
import { Button, Card, Heading, Label, Notice, Page, Icon, colors } from "./ui";
import { OrderPayment } from "./order-payment";
import { PaymentRecovery } from "./payment-recovery";
export function FarmerOrder({
  data,
  busy,
  error,
  onReady,
  onDispatch,
  onRefresh,
}: {
  data: DeliveryData;
  busy: boolean;
  error: string;
  onReady: () => void;
  onDispatch: () => void;
  onRefresh: () => Promise<unknown>;
}) {
  const a = useApp(),
    guide = farmerOrderGuide(data.progress),
    d = data.delivery;
  const [linkError, setLinkError] = useState("");
  const openLink = async (url: string) => {
    setLinkError("");
    try {
      await Linking.openURL(url);
    } catch (e) {
      setLinkError(a.error(e));
    }
  };
  const [section, setSection] = useState<"pickup" | "money" | "updates">("pickup");
  const panels = {
    pickup: (
      <Card>
        <View style={styles.row}>
          <Icon name="pin" size={20} />
          <Heading>Pickup details</Heading>
        </View>
        <Label>
          {data.order.suggestedPickup.address}, {data.order.suggestedPickup.state}
        </Label>
        {d?.package?.pickupDate && (
          <Label>
            {a.ui("Pickup date")}: {d.package.pickupDate}
          </Label>
        )}
        {d?.courier && (
          <View style={styles.row}>
            <Icon name="truck" size={20} />
            <Label>{d.courier}</Label>
          </View>
        )}
        {d?.destination && (
          <View style={styles.row}>
            <Icon name="profile" size={20} />
            <View style={styles.flex}>
              <Label style={styles.strong}>Customer details</Label>
              <Label>{d.destination.name}</Label>
              <Label muted>{d.destination.state}</Label>
            </View>
          </View>
        )}
        {(d?.package?.notes || data.order.packageSuggestion?.notes) && (
          <Label muted>{d?.package?.notes || data.order.packageSuggestion?.notes}</Label>
        )}
        <Label muted>
          {a.ui("Number of packages")}:{" "}
          {d?.package?.packageCount || data.order.packageSuggestion?.packageCount || 1}
        </Label>
        {d?.package && (
          <>
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
          </>
        )}
        {data.progress?.method === "Pickup" && d?.destination?.phone && (
          <Button
            title="Call buyer"
            secondary
            onPress={() => void openLink(`tel:${d.destination.phone}`)}
          />
        )}
        {d?.trackingUrl && safeHttps(d.trackingUrl) && (
          <Button
            title="Track with courier"
            secondary
            onPress={() => void openLink(d.trackingUrl!)}
          />
        )}
        {d?.parcels?.map((parcel) => (
          <Label key={parcel.id}>
            {a.ui("Parcel {number}", { number: parcel.parcelIndex + 1 })}: {a.status(parcel.status)}
          </Label>
        ))}
      </Card>
    ),
    money: (
      <>
        <Card>
          <Heading>Money</Heading>
          <Label>
            {a.ui("Produce value")}: {money(data.order.totalMinor)}
          </Label>
          <Label>Open this section to check payment and earnings.</Label>
        </Card>
        <OrderPayment
          orderId={data.order.id}
          isBuyer={false}
          onChanged={onRefresh}
          revision={`${data.order.status}:${d?.status}`}
          disabled={busy}
        />
        <PaymentRecovery orderId={data.order.id} />
      </>
    ),
    updates: (
      <Card>
        <Heading>Past updates</Heading>
        {d?.events.length ? (
          d.events.map((event) => (
            <View key={event.id} style={{ gap: 4, marginBottom: 12 }}>
              <Label>{a.ui(orderUpdateCopy(`status.${event.status}`, false).title)}</Label>
              <Label muted>{a.date(event.createdAt)}</Label>
            </View>
          ))
        ) : (
          <Label>No activity yet.</Label>
        )}
      </Card>
    ),
  };
  return (
    <Page
      title="Order"
      back={a.back}
      footer={
        guide.action ? (
          <Button
            title={
              busy
                ? "Updating…"
                : guide.action === "ready"
                  ? data.progress?.method === "Pickup"
                    ? "Mark as Ready for Pickup"
                    : "Mark as Ready for Delivery"
                  : "Mark as Dispatched"
            }
            disabled={busy}
            loading={busy}
            onPress={guide.action === "ready" ? onReady : onDispatch}
          />
        ) : undefined
      }
    >
      <Card>
        <View style={styles.row}>
          <View style={styles.icon}>
            <Icon name="orderPacking" nativeSize={{ width: 20, height: 20 }} />
          </View>
          <View style={styles.flex}>
            <Heading>{data.order.title}</Heading>
            <Label>
              {data.order.quantity || "1"}{" "}
              {saleUnitLabel(data.order.salePackaging, a.ui) ||
                a.unit(data.order.unitCode || "UNIT")}{" "}
              · {money(data.order.totalMinor)}
            </Label>
            <Label muted>
              {a.ui("Order")}: {data.order.reference.slice(-8).toUpperCase()}
            </Label>
          </View>
        </View>
        <View style={styles.row}>
          <Icon name={data.progress?.method === "Pickup" ? "pin" : "truck"} size={20} />
          <Label muted>{a.ui(guide.method)}</Label>
        </View>
      </Card>
      <Card>
        <View style={styles.row}>
          <Label muted style={styles.flex}>
            Fulfillment progress
          </Label>
          <Label style={styles.badge}>{a.ui(data.progress?.status || "Checking this order")}</Label>
        </View>
        <View style={styles.row}>
          {["Prepare", "Hand over", "Buyer confirms"].map((label, index) => {
            const handedOver = [
              "Dispatched",
              "Picked Up",
              "In Transit",
              "Awaiting buyer confirmation",
            ].includes(data.progress?.status || "");
            const currentStep = handedOver ? 3 : guide.step;
            const completed = currentStep > index + 1 || !!data.progress?.confirmed;
            const current = currentStep === index + 1 && !data.progress?.confirmed;
            return (
              <View
                key={label}
                style={styles.step}
                accessible
                accessibilityLabel={`${a.ui(label)}: ${a.ui(completed ? "Completed" : current ? "Current" : "Upcoming")}`}
              >
                {index > 0 && (
                  <View
                    style={[
                      styles.connector,
                      { backgroundColor: completed || current ? colors.green : colors.line },
                    ]}
                  />
                )}
                <View
                  style={[
                    styles.marker,
                    (completed || current) && styles.activeMarker,
                    current && styles.currentMarker,
                  ]}
                >
                  <Label
                    style={{
                      color: completed || current ? colors.white : colors.muted,
                      fontFamily: "NotoBold",
                    }}
                  >
                    {completed ? "✓" : index + 1}
                  </Label>
                </View>
                <Label
                  style={{
                    fontSize: 13,
                    textAlign: "center",
                    color: completed || current ? colors.green : colors.muted,
                  }}
                >
                  {a.ui(label)}
                </Label>
              </View>
            );
          })}
        </View>
        <View style={styles.guidance}>
          <Icon
            name={
              guide.action === "ready"
                ? "orderPacking"
                : data.progress?.confirmed
                  ? "sellerCheck"
                  : data.progress?.status === "Payment Pending"
                    ? "wallet"
                    : data.progress?.method === "Pickup"
                      ? "pin"
                      : "truck"
            }
            size={20}
          />
          <View style={styles.flex}>
            <Label style={styles.strong}>{a.ui(guide.title)}</Label>
            <Label muted>{a.ui(guide.body)}</Label>
            {guide.action && (
              <Label muted>
                {a.ui(
                  guide.action === "ready"
                    ? data.progress?.method === "Pickup"
                      ? "Next: buyer collection and confirmation."
                      : "Next: courier collection."
                    : "Next: buyer receives and confirms the order.",
                )}
              </Label>
            )}
          </View>
        </View>
      </Card>
      {(error || linkError) && <Notice text={error || linkError} error />}
      <View style={styles.tabs}>
        {(
          [
            ["pickup", "Pickup details", "pin"],
            ["money", "Money", "wallet"],
            ["updates", "Past updates", "securityDeviceClock"],
          ] as const
        ).map(([key, label, icon]) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityLabel={a.ui(label)}
            accessibilityState={{ selected: section === key }}
            onPress={() => setSection(key)}
            style={[styles.tab, section === key && styles.selectedTab]}
          >
            <Icon name={icon} size={20} />
            <Label
              style={{
                fontSize: 13,
                textAlign: "center",
                color: section === key ? colors.green : colors.muted,
              }}
            >
              {a.ui(label)}
            </Label>
          </Pressable>
        ))}
      </View>
      {panels[section]}
      <Button title="Get help" secondary onPress={() => a.go("help")} />
      <Button title="Refresh" secondary disabled={busy} onPress={() => void onRefresh()} />
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  flex: { flex: 1, minWidth: 100, gap: 4 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  strong: { fontFamily: "NotoBold", color: colors.green },
  badge: {
    backgroundColor: colors.mint,
    color: colors.green,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    fontFamily: "NotoBold",
    flexShrink: 1,
  },
  step: { flex: 1, alignItems: "center", gap: 6 },
  connector: { position: "absolute", top: 16, left: "-50%", width: "100%", height: 2 },
  marker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  activeMarker: { backgroundColor: colors.green },
  currentMarker: { borderWidth: 4, borderColor: colors.mint },
  guidance: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderColor: colors.line },
  tab: {
    flex: 1,
    minHeight: 64,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  selectedTab: { borderBottomColor: colors.green, backgroundColor: colors.mint },
});
