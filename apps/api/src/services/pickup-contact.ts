import { prisma } from "@leetlogic/database";
/** A redirect, delivery state or manually changed order status is not proof of payment. */
export async function buyerPickupContactAvailable(order: {
  id: string;
  buyerId: string;
  totalMinor: bigint;
  status: string;
  financialHold: boolean;
}) {
  if (order.financialHold || !["FUNDED", "DELIVERED", "COMPLETED"].includes(order.status))
    return false;
  const receipts = await prisma.paymentAttempt.findMany({
    where: {
      orderId: order.id,
      buyerId: order.buyerId,
      kind: "ORDER",
      status: "SUCCEEDED",
      confirmedAt: { not: null },
      chargeId: { not: null },
    },
    select: { id: true, paidMinor: true, amountMinor: true, produceMinor: true },
  });
  for (const receipt of receipts) {
    if (
      receipt.produceMinor !== order.totalMinor ||
      receipt.paidMinor !== receipt.amountMinor ||
      receipt.paidMinor <= 0n
    )
      continue;
    if (
      await prisma.moneyJournal.count({
        where: { reference: `funded:${receipt.id}`, orderId: order.id },
      })
    )
      return true;
  }
  return false;
}
export function pickupContactView<T>(value: T, available: boolean): T {
  if (available || !value || typeof value !== "object" || Array.isArray(value)) return value;
  return { ...value, phone: "", email: "" };
}
