import type { Prisma, TradeOrder } from "@leetlogic/database";

/** Balance and inventory writes shared by normal manual escrow and exceptional resolution.
 * Call only after authorization, full-balance, dispute and checkout checks under the order lock. */
export async function settleManualBalance(tx: Prisma.TransactionClient, order: TradeOrder, kind: "RELEASE" | "REFUND") {
  const orderId = order.id, amount = order.heldMinor;
  const feeMinor = kind === "RELEASE" ? amount * BigInt(order.feeBasisPoints) / 10000n : 0n;
  await tx.tradeOrder.update({
    where: { id: orderId },
    data: {
      heldMinor: { decrement: amount },
      ...(kind === "RELEASE"
        ? { releasedMinor: { increment: amount } }
        : { refundedMinor: { increment: amount } }),
      ...(order.heldMinor === amount
        ? { status: kind === "RELEASE" ? "COMPLETED" : "REFUNDED" }
        : {}),
    },
  });
  if (kind === "RELEASE")
    await tx.farmerWallet.upsert({
      where: { farmerProfileId: order.farmerProfileId },
      create: { farmerProfileId: order.farmerProfileId, balanceMinor: amount - feeMinor },
      update: { balanceMinor: { increment: amount - feeMinor } },
    });
  await tx.inventoryMovement.create({
    data: {
      listingId: order.listingId,
      type: kind === "RELEASE" ? "SALE" : "RELEASE",
      quantity: order.quantity,
      referenceType: "order",
      referenceId: orderId,
    },
  });
  if (order.heldMinor === amount)
    await tx.listing.update({
      where: { id: order.listingId },
      data: {
        reservedQuantity: { decrement: order.quantity },
        ...(kind === "RELEASE"
          ? { availableQuantity: { decrement: order.quantity } }
          : {}),
      },
    });

  return feeMinor;
}
