import React, { useEffect, useRef, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { orderJourney } from "../../../../packages/contracts/src/order-journey";
import { orderUpdateCopy } from "../../../../packages/contracts/src/order-updates";
import { saleUnitLabel } from "../../../../packages/contracts/src/sale-packaging";
import { api } from "../lib/api";
import { money, safeHttps, type DeliveryData } from "../lib/domain";
import { useApp } from "../state";
import { Button, Card, Field, Heading, Icon, Label, Notice, Page, colors, s } from "./ui";
import { OrderPayment } from "./order-payment";
import { PaymentRecovery } from "./payment-recovery";
import { OrderDisputes, EvidencePhoto } from "./order-disputes";
import { ReceiptConfirmation } from "./receipt-confirmation";
export function GuidedOrder({
  data,
  error: loadError,
  onRefresh,
}: {
  data: DeliveryData;
  error: string;
  onRefresh: () => Promise<unknown>;
}) {
  const a = useApp(),
    order = data.order,
    d = data.delivery,
    buyer = order.isBuyer;
  const guide = orderJourney({
    buyer,
    progress: data.progress,
    orderStatus: order.status,
    decision: order.farmerDecision,
    handedOver: !!order.handedOverAt,
    money: data.money,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState(false),
    [reject, setReject] = useState(false),
    [reason, setReason] = useState("");
  const [showEvidence, setShowEvidence] = useState(false);
  const [section, setSection] = useState<"details" | "payment" | "history" | "problem" | null>(
    null,
  );
  const running = useRef(false);
  useEffect(() => {
    if (guide.action !== "confirm" || loadError) setReceipt(false);
  }, [guide.action, loadError]);
  const run = async (path: string, body: unknown = {}) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await api(`/orders/${order.id}/delivery/${path}`, { method: "POST", body });
      setReject(false);
      await onRefresh();
    } catch (e) {
      setError(a.error(e));
      await onRefresh().catch(() => {});
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const act = () => {
    if (!guide.action || running.current || loadError) return;
    if (guide.action === "confirm") {
      setReceipt(true);
      return;
    }
    if (guide.action === "accept") {
      void run("decision", { accept: true });
      return;
    }
    if (guide.action === "handover" || guide.action === "dispatch") {
      const path = guide.action;
      a.alert(
        guide.label,
        "Confirm only after handing over every package. Buyer confirmation is still required.",
        [
          { text: "Cancel", style: "cancel" },
          { text: guide.label, onPress: () => void run(path) },
        ],
      );
      return;
    }
    if (guide.action === "ready") void run("ready");
  };
  const link = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (e) {
      setError(a.error(e));
    }
  };
  return (
    <Page
      title="Order"
      back={a.back}
      footer={
        (guide.action || guide.receiptPending) && !reject ? (
          <View style={{ gap: 8 }}>
            <Button
              title={guide.receiptPending ? "Confirm Receipt" : guide.label}
              loading={busy}
              disabled={busy || !!loadError || !guide.action}
              onPress={act}
            />
            <Label muted style={{ textAlign: "center", fontSize: 13 }}>
              {a.ui(guide.after)}
            </Label>
          </View>
        ) : undefined
      }
    >
      <Card style={{ backgroundColor: colors.mint, gap: 12 }}>
        <View style={s.row}>
          <Icon
            name={
              guide.closed || guide.review
                ? "sellerAlert"
                : guide.stage === 4
                  ? "sellerCheck"
                  : guide.action === "accept"
                    ? "bell"
                    : guide.stage === 1
                      ? "orderPacking"
                      : "truck"
            }
            size={32}
            nativeSize={guide.stage === 1 ? { width: 20, height: 20 } : undefined}
          />
          <View style={{ flex: 1 }}>
            <Label muted>{buyer ? "YOUR ORDER" : "FARMER ORDER"}</Label>
            <Heading>{a.ui(guide.title)}</Heading>
          </View>
        </View>
        <Label>{a.ui(guide.body)}</Label>
      </Card>
      {(error || loadError) && <Notice text={error || loadError} error />}
      {order.checkoutErrorCode === "ORDER_EXPIRED" && order.listingId && (
        <Card>
          <Notice text={a.error({ code: "ORDER_EXPIRED" })} />
          <Button title="View produce" onPress={() => a.go("product", order.listingId)} />
        </Card>
      )}
      <Card>
        <Heading>{order.title}</Heading>
        <Label>
          {order.quantity || "1"}{" "}
          {saleUnitLabel(order.salePackaging, a.ui) || a.unit(order.unitCode || "UNIT")}
        </Label>
        <View style={s.between}>
          <Label muted>Produce total</Label>
          <Label style={{ fontFamily: "NotoBold", fontSize: 24 }}>{money(order.totalMinor)}</Label>
        </View>
        <View style={s.row}>
          <Icon name={data.progress?.method === "Pickup" ? "pin" : "truck"} size={22} />
          <Label>{a.ui(data.progress?.method || "Fulfillment")}</Label>
          <Label muted style={{ flex: 1, textAlign: "right", fontSize: 13 }}>
            #{order.reference.slice(-8).toUpperCase()}
          </Label>
        </View>
        {!buyer && d?.destination?.name && (
          <View style={s.row}>
            <Icon name="profile" size={22} />
            <Label>{d.destination.name}</Label>
          </View>
        )}
      </Card>
      {!guide.closed && !guide.review && (
        <Card>
          <Label style={{ fontFamily: "NotoBold" }}>Order progress</Label>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {guide.steps.map((step, index) => (
              <View
                key={step}
                accessible
                accessibilityLabel={`${a.ui(step)}: ${a.ui(index < guide.stage ? "Completed" : index === guide.stage ? "Current" : "Upcoming")}`}
                style={{ flex: 1, alignItems: "center", gap: 6 }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    borderWidth: index === guide.stage ? 3 : 1,
                    borderColor: index <= guide.stage ? colors.green : colors.line,
                    backgroundColor: index < guide.stage ? colors.green : colors.white,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Label
                    style={{
                      fontSize: 13,
                      color: index < guide.stage ? colors.white : colors.green,
                    }}
                  >
                    {index < guide.stage ? "✓" : index + 1}
                  </Label>
                </View>
                <Label
                  style={{
                    fontSize: 12,
                    textAlign: "center",
                    color: index <= guide.stage ? colors.green : colors.muted,
                  }}
                >
                  {a.ui(step)}
                </Label>
              </View>
            ))}
          </View>
        </Card>
      )}
      <Card
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: data.money?.progress?.tone === "warning" ? "#fff5eb" : colors.white,
        }}
      >
        <Icon
          name={data.money?.progress?.tone === "warning" ? "sellerAlert" : "wallet"}
          size={26}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Label
            style={{
              fontFamily: "NotoBold",
              color: data.money?.progress?.tone === "warning" ? "#74301f" : colors.ink,
            }}
          >
            {a.ui(guide.payment)}
          </Label>
          <Label muted>
            {data.money?.progress?.body ||
              (data.progress?.confirmed
                ? "Receipt is confirmed. Payment is tracked separately."
                : "Handover does not release the farmer’s payment.")}
          </Label>
        </View>
      </Card>
      {buyer &&
        data.progress?.method === "Pickup" &&
        data.fulfillment?.state === "ACTIVE" &&
        !data.fulfillment.collectionBuyerAt && (
          <Button
            title="Confirm pickup arrangement"
            disabled={busy}
            onPress={() => void run("collection-confirmation")}
          />
        )}
      {data.progress?.method === "Pickup" && !guide.closed && (
        <Card>
          <View style={s.row}>
            <Icon name="pin" size={22} />
            <Heading>Pickup location</Heading>
          </View>
          <Label>
            {order.suggestedPickup.address}, {order.suggestedPickup.state}
          </Label>
          {d?.package?.pickupDate && <Label>{d.package.pickupDate}</Label>}
          {buyer && order.pickupContactAvailable && order.suggestedPickup.phone && (
            <Button
              title="Call farmer"
              secondary
              onPress={() => void link(`tel:${order.suggestedPickup.phone}`)}
            />
          )}
          {!buyer && d?.destination?.phone && (
            <Button
              title="Call buyer"
              secondary
              onPress={() => void link(`tel:${d.destination.phone}`)}
            />
          )}
        </Card>
      )}
      {d?.trackingUrl && safeHttps(d.trackingUrl) && (
        <Button title="Track delivery" secondary onPress={() => void link(d.trackingUrl!)} />
      )}
      {data.progress?.canReject && !buyer && !reject && (
        <Button
          title="Cannot fulfill this order"
          secondary
          disabled={busy}
          onPress={() => setReject(true)}
        />
      )}
      {reject && (
        <Card>
          <Heading>Why can’t you fulfill it?</Heading>
          <Field label="Reason" value={reason} onChangeText={setReason} multiline maxLength={500} />
          <Label muted>The buyer will be notified and the refund will be reviewed.</Label>
          <Button
            title="Decline Order"
            loading={busy}
            disabled={busy || reason.trim().length < 5}
            onPress={() =>
              a.alert("Decline Order", "The order will stop and the buyer will be notified.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Decline Order",
                  onPress: () => void run("decision", { accept: false, reason: reason.trim() }),
                },
              ])
            }
          />
          <Button title="Keep order" secondary disabled={busy} onPress={() => setReject(false)} />
        </Card>
      )}
      {(
        [
          ["details", "Order details", "orderPacking"],
          ["payment", "Payment and receipt", "wallet"],
          ["history", "Order notifications", "securityDeviceClock"],
          ["problem", "Report a Problem", "sellerAlert"],
        ] as const
      ).map(([key, label, icon]) => (
        <React.Fragment key={key}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a.ui(label)}
            accessibilityState={{ expanded: section === key }}
            onPress={() => setSection(section === key ? null : key)}
            style={{
              minHeight: 56,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              borderBottomWidth: 1,
              borderColor: colors.line,
            }}
          >
            <Icon name={icon} size={22} />
            <Label style={{ flex: 1 }}>{a.ui(label)}</Label>
            <Label>{section === key ? "−" : "+"}</Label>
          </Pressable>
          {section === key &&
            (key === "details" ? (
              <Card>
                <Label>{order.description}</Label>
                <Label>
                  {a.ui("Number of packages")}:{" "}
                  {d?.package?.packageCount || order.packageSuggestion?.packageCount || 1}
                </Label>
                <Label>{d?.package?.notes || order.packageSuggestion?.notes}</Label>
                {order.rejectionReason && <Notice text={order.rejectionReason} />}
              </Card>
            ) : key === "payment" ? (
              <>
                <OrderPayment
                  orderId={order.id}
                  isBuyer={buyer}
                  onChanged={onRefresh}
                  revision={`${order.status}:${d?.status}`}
                  disabled={busy}
                />
                <PaymentRecovery orderId={order.id} />
                {order.receiptPhoto && (
                  <>
                    <Button
                      title="View receipt photo"
                      secondary
                      onPress={() => setShowEvidence(!showEvidence)}
                    />
                    {showEvidence && (
                      <EvidencePhoto path={`/orders/${order.id}/delivery/receipt-photo`} />
                    )}
                  </>
                )}
              </>
            ) : key === "history" ? (
              <Card>
                {d?.events?.length ? (
                  d.events.map((event) => (
                    <View key={event.id} style={{ gap: 4 }}>
                      <Label>{a.ui(orderUpdateCopy(`status.${event.status}`, buyer).title)}</Label>
                      <Label muted>{a.date(event.createdAt)}</Label>
                    </View>
                  ))
                ) : (
                  <Label>No updates yet.</Label>
                )}
              </Card>
            ) : (
              <OrderDisputes orderId={order.id} onChanged={onRefresh} />
            ))}
        </React.Fragment>
      ))}
      <Button title="Refresh order" secondary loading={busy} onPress={() => void runRefresh()} />
      <ReceiptConfirmation
        key={order.id}
        orderId={order.id}
        visible={receipt && guide.action === "confirm" && !loadError}
        onClose={() => setReceipt(false)}
        onConfirmed={onRefresh}
      />
    </Page>
  );
  async function runRefresh() {
    try {
      await onRefresh();
    } catch (e) {
      setError(a.error(e));
    }
  }
}
