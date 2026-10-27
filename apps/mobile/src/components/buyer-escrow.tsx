import React, { useEffect } from "react";
import { AppState, Pressable, View } from "react-native";
import { useApp, useResource } from "../state";
import { Icon, Label, Notice, colors } from "./ui";
import { money } from "../lib/domain";
export function BuyerEscrow() {
  const a = useApp();
  const r = useResource<{ heldMinor: string; orderCount: number; activeDispatch: number }>(
    "/orders/escrow-summary",
    !!a.user,
  );
  useEffect(() => {
    if (!a.user) return;
    const timer = setInterval(() => void r.reload(), 30000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void r.reload();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [a.user, r.reload]);
  if (!a.user) return null;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "stretch" }}>
        {[
          {
            title: "Active dispatch",
            icon: "truck" as const,
            value: r.data ? a.ui("{count} Shipments", { count: r.data.activeDispatch }) : "—",
          },
          {
            title: "Trade escrow",
            icon: "wallet" as const,
            value: r.data ? money(r.data.heldMinor) : "—",
          },
        ].map((item) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            accessibilityLabel={a.ui(item.title)}
            accessibilityHint={a.ui("View orders")}
            onPress={() => a.go("orders")}
            style={{
              flex: 1,
              minWidth: 0,
              backgroundColor: "white",
              borderRadius: 16,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            <Icon name={item.icon} nativeSize={{ width: 22, height: 22 }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Label muted style={{ fontSize: 14, lineHeight: 20 }}>
                {item.title}
              </Label>
              <Label
                adjustsFontSizeToFit
                numberOfLines={1}
                style={{ color: colors.ink, fontSize: 16, lineHeight: 24, fontFamily: "NotoBold" }}
              >
                {item.value}
              </Label>
            </View>
          </Pressable>
        ))}
      </View>
      {r.error && <Notice text={r.error} error />}
    </View>
  );
}
