import { Platform } from "react-native";
import { api } from "./api";

export async function registerOrderPush(requestPermission = false) {
  if (Platform.OS === "web") return;
  const Constants = (await import("expo-constants")).default;
  if (Constants.appOwnership === "expo") {
    if (requestPermission)
      throw new Error("Order notifications require an installed LeetLogic build.");
    return;
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    if (requestPermission)
      throw new Error("Push notifications are not configured in this build yet.");
    return;
  }
  const notifications = await import("expo-notifications");
  if (Platform.OS === "android")
    await notifications.setNotificationChannelAsync("paid-orders", {
      name: "Paid orders",
      importance: notifications.AndroidImportance.HIGH,
    });
  let permission = await notifications.getPermissionsAsync();
  if (!permission.granted && requestPermission)
    permission = await notifications.requestPermissionsAsync();
  if (!permission.granted) {
    if (requestPermission)
      throw new Error("Allow notifications in your device settings to receive paid-order alerts.");
    return;
  }
  const token = (await notifications.getExpoPushTokenAsync({ projectId })).data;
  await api("/orders/push-device", { method: "POST", body: { token } });
}
