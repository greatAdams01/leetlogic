export type BankAccount = {
  id: string;
  bankName: string;
  accountName: string;
  accountLastFour: string;
  usable: boolean;
};
export type FinancialSummary = {
  enabled: boolean;
  account: { ready: boolean; status: string } | null;
  destinations: BankAccount[];
  earnings: { availableMinor: string; reservedMinor: string; balanceMinor: string };
  heldMinor: string;
  payoutFeeMinor: string | null;
  operations: {
    id: string;
    kind: string;
    status: string;
    amountMinor: string;
    feeMinor: string;
    createdAt?: string;
  }[];
};
export function sellerPaymentAction(data: FinancialSummary | null) {
  if (!data || !data.enabled) return { title: "Payments and earnings", route: "finance" as const };
  if (!data.account?.ready) return { title: "Set up payments", route: "finance" as const };
  if (!data.destinations.some((bank) => bank.usable))
    return { title: "Add bank account", route: "banks" as const };
  return { title: "Withdraw", route: "finance" as const };
}
export const bankVerificationPending = (status: string) =>
  ["REQUESTED", "QUEUED", "PROCESSING", "PROVIDER_PENDING"].includes(status);

export function withdrawalAmounts(available: string, fee: string | null, input: string) {
  const maximum =
    fee === null ? 0n : BigInt(available) > BigInt(fee) ? BigInt(available) - BigInt(fee) : 0n;
  const parts = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(input.trim());
  const amount = parts ? BigInt(parts[1]!) * 100n + BigInt((parts[2] || "").padEnd(2, "0")) : 0n;
  return {
    maximum: maximum.toString(),
    fullAmount: `${maximum / 100n}.${String(maximum % 100n).padStart(2, "0")}`,
    valid: fee !== null && !!parts && amount > 0n && amount <= maximum,
    total: (amount + BigInt(fee || "0")).toString(),
  };
}
