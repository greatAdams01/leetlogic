import type { Listing, Order } from "./domain";

export function sellerSummary(listings: Listing[], orders: Order[]) {
  const active = listings.filter((item) => item.status === "ACTIVE");
  const lowStock = active.filter((item) => {
    const remaining = Number(item.availableQuantity) - Number(item.reservedQuantity);
    return remaining > 0 && remaining <= 2;
  });
  // Unpaid orders must never be presented as orders ready to pack.
  const toPack = orders.filter(
    (order) =>
      order.status === "FUNDED" &&
      ![
        "PICKED_UP",
        "IN_TRANSIT",
        "OUT_FOR_DELIVERY",
        "FAILED_ATTEMPT",
        "DELIVERED",
        "CANCELLED",
        "RETURNED",
        "RETURNING",
      ].includes(order.delivery?.status || ""),
  );
  return { active, lowStock, toPack };
}
export function sellerGreeting(hour: number) {
  return hour < 12
    ? "Good morning, {name}"
    : hour < 17
      ? "Good afternoon, {name}"
      : "Good evening, {name}";
}
export type SavedListingDraft = {
  id: string;
  fields: { title: string; quantity: string; unitCode: string; photoId?: string };
};
export function hasDeviceDraft(value: unknown): value is { title?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const form = value as Record<string, unknown>;
  return ["title", "description", "quantity", "price", "photoId", "categoryId"].some(
    (key) => typeof form[key] === "string" && form[key].trim().length > 0,
  );
}
