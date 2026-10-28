import type { NotificationResponse } from "expo-notifications";
import React, { useEffect } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import { useApp } from "../state";
import { registerOrderPush } from "../lib/push-notifications";

export function OrderPush() {
  const a = useApp();
  useEffect(() => {
    if (
      !a.user ||
      a.role !== "SELLER" ||
      Platform.OS === "web" ||
      Constants.appOwnership === "expo"
    )
      return;
    let active = true;
    let remove = () => {};
    void registerOrderPush().catch(() => {});
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active") void registerOrderPush().catch(() => {});
    });
    void import("expo-notifications")
      .then(async (notifications) => {
        if (!active) return;
        notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
        const open = (response: NotificationResponse) => {
          const data = response.notification.request.content.data;
          if (
            active &&
            data?.kind === "paid-order" &&
            data.userId === a.user!.id &&
            typeof data.orderId === "string"
          ) {
            a.go("delivery", data.orderId);
            void notifications.clearLastNotificationResponseAsync();
          }
        };
        const listener = notifications.addNotificationResponseReceivedListener(open);
        remove = () => listener.remove();
        const last = await notifications.getLastNotificationResponseAsync();
        if (last) open(last);
      })
      .catch(() => {});
    return () => {
      active = false;
      remove();
      foreground.remove();
    };
  }, [a.user?.id, a.role, a.go]);
  return null;
}
