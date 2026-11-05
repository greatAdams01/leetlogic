import React, { useState } from "react";
import { View, Linking, Pressable } from "react-native";
import { farmerOrderGuide } from "../../../../packages/contracts/src/farmer-order";
import { orderUpdateCopy } from "../../../../packages/contracts/src/order-updates";
import { saleUnitLabel } from "../../../../packages/contracts/src/sale-packaging";
import { useApp } from "../state";
import { money, safeHttps, type DeliveryData } from "../lib/domain";
import { Button, Card, Heading, Label, Notice, Page, colors } from "./ui";
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
  const [section, setSection] = useState<"pickup" | "money" | "updates" | null>(null);
  const panels = {
    pickup: (
      <Card>
        <Heading>Pickup details</Heading>
        <Label>
          {data.order.suggestedPickup.address}, {data.order.suggestedPickup.state}
        </Label>
        {d?.package?.pickupDate && (
          <Label>
            {a.ui("Pickup date")}: {d.package.pickupDate}
          </Label>
        )}
        {d?.courier && <Label>{d.courier}</Label>}
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
            title={guide.action === "ready" ? "Order is ready" : "Rider has collected it"}
            disabled={busy}
            onPress={guide.action === "ready" ? onReady : onDispatch}
          />
        ) : undefined
      }
    >
      <Card>
        <Label muted>{a.ui(guide.method)}</Label>
        <Heading>{data.order.title}</Heading>
        <Label style={{ fontFamily: "NotoBold", fontSize: 30 }}>
          {data.order.quantity || "1"}{" "}
          {saleUnitLabel(data.order.salePackaging, a.ui) || a.unit(data.order.unitCode || "UNIT")}
        </Label>
        <Label muted>
          {a.ui("Order")}: {data.order.reference.slice(-8).toUpperCase()}
        </Label>
      </Card>
      <Card style={{ backgroundColor: colors.mint }}>
        <Heading>{a.ui(guide.title)}</Heading>
        <Label style={{ fontSize: 18 }}>{a.ui(guide.body)}</Label>
        {d?.package?.pickupDate && (
          <Label>
            {a.ui("Pickup date")}: {d.package.pickupDate.split("-").reverse().join("/")}
          </Label>
        )}
        {(d?.package || data.order.packageSuggestion) && (
          <Label>
            {a.ui("Number of packages")}:{" "}
            {d?.package?.packageCount || data.order.packageSuggestion?.packageCount || 1}
          </Label>
        )}
        {(d?.package?.notes || data.order.packageSuggestion?.notes) && (
          <Label>{d?.package?.notes || data.order.packageSuggestion?.notes}</Label>
        )}
      </Card>
      {(error || linkError) && <Notice text={error || linkError} error />}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {["Prepare", "Hand over", "Finished"].map((label, index) => (
          <View key={label} style={{ flex: 1, gap: 8 }}>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: guide.step > index ? colors.green : "#dce5df",
              }}
            />
            <Label style={{ fontSize: 14 }}>{a.ui(label)}</Label>
          </View>
        ))}
      </View>
      {(
        [
          ["pickup", "Pickup details"],
          ["money", "Money"],
          ["updates", "Past updates"],
        ] as const
      ).map(([key, label]) => (
        <React.Fragment key={key}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a.ui(label)}
            accessibilityState={{ expanded: section === key }}
            onPress={() => setSection(section === key ? null : key)}
            style={{
              minHeight: 56,
              padding: 16,
              borderWidth: 1,
              borderColor: "#dce5df",
              borderRadius: 12,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Label>{a.ui(label)}</Label>
            <Label>{section === key ? "−" : "+"}</Label>
          </Pressable>
          {section === key ? panels[key] : null}
        </React.Fragment>
      ))}
      <Button title="Get help" secondary onPress={() => a.go("help")} />
      <Button title="Refresh" secondary disabled={busy} onPress={() => void onRefresh()} />
    </Page>
  );
}
