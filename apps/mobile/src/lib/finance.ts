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
  operations: { id: string; kind: string; status: string; amountMinor: string; feeMinor: string }[];
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
