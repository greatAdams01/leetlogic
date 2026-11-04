import React from "react";
import { Pressable, View } from "react-native";
import { useApp } from "../state";
import { useOrderInbox } from "../lib/order-inbox";
import { Icon, Label, colors } from "./ui";
export function NotificationBell({ light = false }: { light?: boolean }) {
  const a = useApp(),
    inbox = useOrderInbox(),
    count = inbox.data?.unreadCount || 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a.ui("Notifications")}
      accessibilityHint={count ? `${count} ${a.ui("Unread")}` : undefined}
      onPress={() => a.go("notifications")}
      style={{
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 22,
        backgroundColor: light ? "#ffffffdd" : "#edf5ee",
      }}
    >
      <Icon name="bell" size={22} />
      {count > 0 && (
        <View
          style={{
            position: "absolute",
            right: -2,
            top: -2,
            minWidth: 20,
            height: 20,
            paddingHorizontal: 4,
            borderRadius: 10,
            backgroundColor: colors.green,
            alignItems: "center",
            justifyContent: "center",
            borderColor: light ? "white" : colors.paper,
            borderWidth: 1,
          }}
        >
          <Label style={{ color: "white", fontSize: 11, fontFamily: "NotoBold" }}>
            {count > 99 ? "99+" : count}
          </Label>
        </View>
      )}
    </Pressable>
  );
}
