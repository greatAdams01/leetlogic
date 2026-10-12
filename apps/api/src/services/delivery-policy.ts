export const terminalDeliveryStates = ["DELIVERED", "CANCELLED", "RETURNED"];
const rank: Record<string, number> = {
  BOOKED: 0,
  PICKED_UP: 1,
  IN_TRANSIT: 2,
  FAILED_ATTEMPT: 3,
  RETURNING: 4,
  DELIVERED: 5,
  CANCELLED: 5,
  RETURNED: 6,
};
export function normalizeDeliveryStatus(status: string): string | undefined {
  return (
    {
      pending: "BOOKED",
      confirmed: "BOOKED",
      picked_up: "PICKED_UP",
      in_transit: "IN_TRANSIT",
      completed: "DELIVERED",
      delivered: "DELIVERED",
      cancelled: "CANCELLED",
      failed: "FAILED_ATTEMPT",
      failed_delivery: "FAILED_ATTEMPT",
      returning: "RETURNING",
      returned: "RETURNED",
    } as Record<string, string>
  )[status.toLowerCase()];
}
export function canAdvanceDelivery(current: string, next: string) {
  if (current === "DELIVERED" && ["RETURNING", "RETURNED"].includes(next)) return true;
  if (current === next || terminalDeliveryStates.includes(current)) return false;
  if (current === "FAILED_ATTEMPT" && next === "IN_TRANSIT") return true;
  return (rank[next] ?? -1) >= (rank[current] ?? -1);
}
