import { estimateSale, saleAmounts, type FarmerOrderEarnings } from "@leetlogic/contracts";
import { prisma, type TradeOrder } from "@leetlogic/database";
import { mode } from "./payments.js";

export async function marketplaceCommission() {
  const settings = await prisma.marketplaceSettings.findUnique({
    where: { id: "marketplace" }, select: { platformFeeBasisPoints: true },
  });
  // Match the MarketplaceSettings database default before settings are initialized.
  return settings?.platformFeeBasisPoints ?? 600;
}

export async function farmerOrderEarnings(order: TradeOrder): Promise<FarmerOrderEarnings> {
  const basisPoints = order.feeBasisPoints;
  if (order.releasedMinor > 0n) {
    const { _sum } = await prisma.escrowEntry.aggregate({
      where: { orderId: order.id, kind: "RELEASE" }, _sum: { amountMinor: true, feeMinor: true },
    });
    if (_sum.amountMinor !== null) {
      return { basisPoints, state: "CREDITED", ...saleAmounts(_sum.amountMinor, _sum.feeMinor ?? 0n) };
    }
  }
  if (["CANCELLED", "REFUNDED"].includes(order.status) ||
      (order.status === "COMPLETED" && order.heldMinor === 0n && order.releasedMinor === 0n)) {
    return { basisPoints, state: "NO_CREDIT", ...saleAmounts(0n, 0n) };
  }
  return { basisPoints, state: "EXPECTED", ...estimateSale(order.totalMinor, basisPoints) };
}

export async function farmerSaleHistory(userId: string, cursor?: string) {
  const pageSize = 20;
  const rows = await prisma.$queryRaw<{
    id: string; orderId: string; reference: string; title: string; createdAt: Date;
    amountMinor: bigint; feeMinor: bigint;
  }[]>`
    SELECT e.id, e."orderId", o.reference, l.title, e."createdAt", e."amountMinor", e."feeMinor"
    FROM escrow_entries e
    JOIN trade_orders o ON o.id = e."orderId"
    JOIN farmer_profiles f ON f.id = o."farmerProfileId"
    JOIN listings l ON l.id = o."listingId"
    WHERE f.user_id = ${userId}::uuid AND e.kind = 'RELEASE'
      AND (o.funds_provider IS DISTINCT FROM 'bachs' OR EXISTS (
        SELECT 1 FROM money_operations m WHERE m."orderId" = o.id AND m.kind = 'RELEASE'
          AND m.mode = ${mode()} AND e."mutationKey" = 'bachs:' || m.id::text
      ))
      AND (${cursor ?? null}::uuid IS NULL OR (e."createdAt", e.id) < (
        SELECT c."createdAt", c.id FROM escrow_entries c
        JOIN trade_orders co ON co.id = c."orderId"
        WHERE c.id = ${cursor ?? null}::uuid AND co."farmerProfileId" = f.id AND c.kind = 'RELEASE'
      ))
    ORDER BY e."createdAt" DESC, e.id DESC
    LIMIT ${pageSize + 1}
  `;
  const items = rows.slice(0, pageSize).map(({ amountMinor, feeMinor, ...sale }) => ({
    ...sale, ...saleAmounts(amountMinor, feeMinor),
  }));
  return { items, nextCursor: rows.length > pageSize ? items.at(-1)!.id : null };
}
