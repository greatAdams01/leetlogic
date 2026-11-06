export type NotificationKind = "Orders" | "Payments" | "Delivery" | "Pickup" | "System";
export function notificationKind(key: string, listingId?: string): NotificationKind {
  if (listingId || /listing|SYSTEM|ANNOUNCEMENT|ACCOUNT|SECURITY|WELCOME/i.test(key))
    return "System";
  if (key === "order.paid" || /ORDER_ACCEPTED|ORDER_REJECTED/.test(key)) return "Orders";
  if (/PAYMENT|PAID|RECOVERY|REFUND|RELEASE/.test(key)) return "Payments";
  if (/PICKUP|COLLECT|READY_FOR_PICKUP/.test(key)) return "Pickup";
  return /BOOK|DISPATCH|TRANSIT|DELIVER|SHIP|COURIER|TRACK|RETURN|QUOTE|FAILED_ATTEMPT/i.test(key)
    ? "Delivery"
    : "System";
}
export function notificationDay(at: string, now = new Date()) {
  return new Date(at).toDateString() === now.toDateString() ? "Today" : "Earlier";
}
