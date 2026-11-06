import type { Prisma } from "@leetlogic/database";
export function ownedOrderWhere(
  userId: string,
  seller: boolean,
  query: { q?: string | undefined; filter?: string | undefined },
): Prisma.TradeOrderWhereInput {
  const scope: Prisma.TradeOrderWhereInput = seller
    ? {
        farmerProfile: { userId },
        ledger: { some: { kind: "FUND" } },
        status: { notIn: ["AWAITING_PAYMENT", "CANCELLED"] },
      }
    : { buyerId: userId };
  const filters: Prisma.TradeOrderWhereInput[] = [scope];
  if (query.filter === "COMPLETED")
    filters.push({
      OR: [{ status: "COMPLETED" }, { deliveryConfirmedAt: { not: null } }],
      status: { notIn: ["CANCELLED", "REFUNDED"] },
    });
  if (query.filter === "CANCELLED")
    filters.push({
      OR: [{ status: { in: ["CANCELLED", "REFUNDED"] } }, { farmerDecision: "REJECTED" }],
    });
  if (query.filter === "ACTIVE")
    filters.push({
      status: { notIn: ["COMPLETED", "CANCELLED", "REFUNDED"] },
      deliveryConfirmedAt: null,
      farmerDecision: { not: "REJECTED" },
    });
  if (query.q)
    filters.push({
      OR: [
        { reference: { contains: query.q, mode: "insensitive" } },
        { listing: { title: { contains: query.q, mode: "insensitive" } } },
        { farmerProfile: { farmName: { contains: query.q, mode: "insensitive" } } },
        {
          farmerProfile: {
            user: {
              profile: {
                OR: [
                  { fullName: { contains: query.q, mode: "insensitive" } },
                  { displayName: { contains: query.q, mode: "insensitive" } },
                ],
              },
            },
          },
        },
      ],
    });
  return { AND: filters };
}
