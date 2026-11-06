import {
  notificationKind,
  notificationDay,
} from "../../../../packages/contracts/src/notification-presentation";
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { useApp } from "../state";
import { useOrderInbox } from "../lib/order-inbox";
import { orderUpdateCopy } from "../../../../packages/contracts/src/order-updates";
import { Page, Heading, Label, Button, Card, Notice, colors, s, Icon } from "../components/ui";
export function Notifications() {
  const a = useApp(),
    r = useOrderInbox(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("All");
  const items = (r.data?.items || []).filter(
    (i) =>
      filter === "All" ||
      (filter === "Unread" ? !i.readAt : notificationKind(i.messageKey, i.listingId) === filter),
  );
  const open = (item: import("../lib/order-inbox").InboxItem) => {
    if (!item.readAt) void r.read([item.id]).catch(() => {});
    if (item.listingId) a.go("myListings");
    else if (item.orderId)
      a.go(/RECOVERY|REFUND/.test(item.messageKey) ? "recovery" : "delivery", item.orderId);
  };
  return (
    <Page title="Notifications" back={a.back} loading={r.loading}>
      <Heading>Notifications</Heading>
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

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {["All", "Unread", "Orders", "Payments", "Delivery", "Pickup", "System"].map((value) => (
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
        <Notice text="No notifications match this filter." />
      )}
      {(r.error || error) && <Notice text={r.error || error} error />}
      {!r.loading && !r.data?.items.length && (
        <Notice text="Your order, payment and delivery notifications will appear here." />
      )}
      {items.map((i, index) => {
        const copy = orderUpdateCopy(i.messageKey, a.role !== "SELLER");
        const kind = notificationKind(i.messageKey, i.listingId);
        const icons = {
          Orders: "orderPacking",
          Payments: "wallet",
          Delivery: "truck",
          Pickup: "pin",
          System: "bell",
        } as const;
        return (
          <React.Fragment key={i.id}>
            {(index === 0 ||
              notificationDay(items[index - 1]!.createdAt) !== notificationDay(i.createdAt)) && (
              <Label muted style={{ fontFamily: "NotoBold", marginTop: 8 }}>
                {a.ui(notificationDay(i.createdAt))}
              </Label>
            )}
            <Pressable
              key={i.id}
              accessibilityRole="button"
              accessibilityLabel={`${a.ui(copy.title)}${!i.readAt ? `, ${a.ui("Unread")}` : ""}`}
              disabled={!i.orderId && !i.listingId}
              onPress={() => open(i)}
            >
              <Card
                style={{
                  borderLeftWidth: i.readAt ? 1 : 4,
                  borderColor: colors.line,
                  borderLeftColor: i.readAt ? colors.line : colors.green,
                  backgroundColor: i.readAt ? colors.white : colors.mint,
                  gap: 8,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: colors.paper,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name={icons[kind]} size={22} />
                  </View>
                  <Label muted style={{ flex: 1 }}>
                    {a.ui(kind)}
                  </Label>
                  {!i.readAt && (
                    <Label style={{ color: colors.green, fontSize: 12, fontFamily: "NotoBold" }}>
                      Unread
                    </Label>
                  )}
                </View>
                <Label style={{ fontFamily: "NotoBold", color: colors.green }}>
                  {a.ui(copy.title)}
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
                {(i.orderId || i.listingId) && (
                  <Label style={{ color: colors.green, fontFamily: "NotoBold" }}>
                    {a.ui(i.listingId ? "View listing" : "View order")}
                  </Label>
                )}
              </Card>
            </Pressable>
          </React.Fragment>
        );
      })}
      <Button title="Refresh" secondary onPress={() => void r.reload()} />
    </Page>
  );
}
