import React, { useState } from "react";
import { PaymentRecovery } from "../components/payment-recovery";
import { Pressable, View } from "react-native";
import { useApp } from "../state";
import { useOrderInbox } from "../lib/order-inbox";
import { orderUpdateCopy } from "../../../../packages/contracts/src/order-updates";
import { Page, Heading, Label, Button, Card, Notice, colors, s } from "../components/ui";
export function Notifications() {
  const a = useApp(),
    r = useOrderInbox(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("All");
  const items = (r.data?.items || []).filter(
    (i) =>
      filter === "All" ||
      (filter === "Unread"
        ? !i.readAt
        : filter === "Payments"
          ? /PAYMENT|PAID|RECOVERY|REFUND/.test(i.messageKey)
          : filter === "Listings"
            ? !!i.listingId
            : !i.listingId && !/PAYMENT|PAID|RECOVERY|REFUND/.test(i.messageKey)),
  );
  const open = (item: import("../lib/order-inbox").InboxItem) => {
    if (!item.readAt) void r.read([item.id]).catch(() => {});
    if (item.listingId) a.go("myListings");
    else if (item.orderId)
      a.go(/RECOVERY|REFUND/.test(item.messageKey) ? "recovery" : "delivery", item.orderId);
  };
  return (
    <Page title="Updates" back={a.back} loading={r.loading}>
      <Heading>Order and account updates</Heading>
      <Label muted>
        {a.ui("Unread")}: {r.data?.unreadCount || 0}
      </Label>
      {r.data?.unreadCount ? (
        <Button
          title="Mark all as read"
          secondary
          disabled={busy}
          onPress={() => {
            setBusy(true);
            void r
              .readAll()
              .catch((e) => setError(a.error(e)))
              .finally(() => setBusy(false));
          }}
        />
      ) : null}
      <PaymentRecovery />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {["All", "Unread", "Payments", "Delivery", "Listings"].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === value }}
            onPress={() => setFilter(value)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 24,
              backgroundColor: filter === value ? colors.green : "#eef2ef",
            }}
          >
            <Label style={{ color: filter === value ? "#fff" : colors.green }}>{a.ui(value)}</Label>
          </Pressable>
        ))}
      </View>
      {!r.loading && !items.length && !!r.data?.items.length && (
        <Notice text="No updates match this filter." />
      )}
      {(r.error || error) && <Notice text={r.error || error} error />}
      {!r.loading && !r.data?.items.length && (
        <Notice text="Listing approvals, paid orders and delivery updates will appear here." />
      )}
      {items.map((i) => {
        const copy = orderUpdateCopy(i.messageKey, a.role !== "SELLER");
        return (
          <Pressable
            key={i.id}
            accessibilityRole="button"
            accessibilityLabel={a.ui(copy.title)}
            onPress={() => open(i)}
          >
            <Card style={{ borderLeftWidth: i.readAt ? 0 : 4, borderLeftColor: colors.green }}>
              <Label style={{ fontFamily: "NotoBold", color: colors.green }}>
                {a.ui(copy.title)}
                {!i.readAt ? ` · ${a.ui("Unread")}` : ""}
              </Label>
              {i.produceTitle && <Label>{i.produceTitle}</Label>}
              {i.orderReference && (
                <Label muted>
                  {a.ui("Order")}: {i.orderReference.slice(-8).toUpperCase()}
                </Label>
              )}
              <Label>{a.ui(copy.body)}</Label>
              <Label muted style={s.small}>
                {a.date(i.createdAt)}
              </Label>
              <Label style={{ color: colors.green, fontFamily: "NotoBold" }}>
                {a.ui(i.listingId ? "View listing" : "View order")}
              </Label>
            </Card>
          </Pressable>
        );
      })}
      <Button title="Refresh" secondary onPress={() => void r.reload()} />
    </Page>
  );
}
