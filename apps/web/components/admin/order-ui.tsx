import type { ReactNode } from "react";
import { deliveryStatusCopy } from "../../../../packages/contracts/src/delivery-visibility";
import type { AdminOrderRecord } from "./order-types";

export const orderStatusLabel = (status: string) => ({
  AWAITING_PAYMENT: "Awaiting payment", FUNDED: "Paid", DELIVERED: "Receipt confirmed",
  COMPLETED: "Completed", REFUNDED: "Refunded", CANCELLED: "Cancelled",
} as Record<string, string>)[status] || "Status not available";

export const farmerDecisionLabel = (decision: string) => ({
  PENDING: "Awaiting farmer", ACCEPTED: "Accepted", REJECTED: "Declined", LEGACY: "Earlier order",
} as Record<string, string>)[decision] || "Not recorded";

export function OperationsBadge({ value, label }: { value: string; label?: string }) {
  const tone = /review|attention|declined/i.test(label || "") || ["REJECTED", "BOOKING_BLOCKED", "BOOKING_UNCERTAIN", "FAILED_ATTEMPT", "RETURNING", "RETURNED", "MANUAL_REVIEW"].includes(value)
    ? "warning"
    : ["FUNDED", "ACCEPTED", "COMPLETED", "DELIVERED", "REFUNDED", "AVAILABLE", "SECURED"].includes(value)
      ? "success" : "neutral";
  return <span className={`finance-badge ${tone}`}>{label || deliveryStatusCopy(value).label}</span>;
}

export function OrderFacts({ items }: { items: [string, ReactNode][] }) {
  return <dl className="finance-facts">{items.map(([label, value]) =>
    <div key={label}><dt>{label}</dt><dd>{value ?? "Not recorded"}</dd></div>,
  )}</dl>;
}

export function adminFulfillmentLabel(data: AdminOrderRecord) {
  if (data.order.status === "AWAITING_PAYMENT") return "Waiting for payment";
  if (data.progress.awaitingAcceptance && !data.staffContext.financialHold) return "Awaiting farmer acceptance";
  return data.progress.status;
}

export function adminNextStep(data: AdminOrderRecord) {
  if (["CANCELLED", "REFUNDED"].includes(data.order.status)) return "This order is closed. Check the payment summary for any refund details.";
  if (data.staffContext.financialHold || data.staffContext.disputes.length) return "Resolve the order review before dispatch or payment release can continue.";
  if (data.order.status === "AWAITING_PAYMENT") return "Waiting for the buyer’s payment. Preparation and dispatch cannot start yet.";
  if (data.order.farmerDecision === "REJECTED") return "The farmer declined this order. Review the refund before arranging delivery.";
  if (data.order.farmerDecision === "PENDING") return "Waiting for the farmer to accept the order.";
  if (data.order.deliveryConfirmedAt) return "Receipt confirmation is recorded. Check the payment summary for the farmer’s payout.";
  return data.progress.next;
}
