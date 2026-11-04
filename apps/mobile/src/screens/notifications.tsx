import React, { useState } from "react";
import { Pressable } from "react-native";
import { useApp } from "../state";
import { useOrderInbox } from "../lib/order-inbox";
import { orderUpdateCopy } from "../../../../packages/contracts/src/order-updates";
import { Page, Heading, Label, Button, Card, Notice, colors, s } from "../components/ui";
export function Notifications() {
  const a = useApp(),
    r = useOrderInbox(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const open = (item: import("../lib/order-inbox").InboxItem) => {
    if (!item.readAt) void r.read([item.id]).catch(() => {});
    if (item.listingId) a.go("myListings");
    else if (item.orderId)
      a.go(/RECOVERY|REFUND/.test(item.messageKey) ? "recovery" : "delivery", item.orderId);
  };
  return (
    <Page title="Notifications" back={a.back} loading={r.loading}>
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
      {(r.error || error) && <Notice text={r.error || error} error />}
      {!r.loading && !r.data?.items.length && (
        <Notice text="Listing approvals, paid orders and delivery updates will appear here." />
      )}
      {r.data?.items.map((i) => {
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
