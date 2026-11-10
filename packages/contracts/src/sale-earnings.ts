export function commissionRate(basisPoints: number) {
  return `${basisPoints / 100}%`;
}

export function saleAmounts(grossMinor: bigint, commissionMinor: bigint) {
  return {
    grossMinor: grossMinor.toString(),
    commissionMinor: commissionMinor.toString(),
    netMinor: (grossMinor - commissionMinor).toString(),
  };
}

export function estimateSale(grossMinor: bigint, basisPoints: number) {
  return saleAmounts(grossMinor, grossMinor * BigInt(basisPoints) / 10_000n);
}

export type FarmerOrderEarnings = ReturnType<typeof saleAmounts> & {
  basisPoints: number;
  state: "EXPECTED" | "CREDITED" | "NO_CREDIT";
};

export type FarmerSaleHistory = {
  items: (ReturnType<typeof saleAmounts> & {
    id: string;
    orderId: string;
    reference: string;
    title: string;
    createdAt: string;
  })[];
  nextCursor: string | null;
};
