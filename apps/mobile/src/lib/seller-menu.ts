export type SellerMenuState =
  "buyer" | "incomplete" | "pending" | "approved" | "rejected" | "changes" | "unknown";
export function sellerMenuState(
  farmer: { verificationStatus: string } | null | undefined,
  role: "BUYER" | "SELLER",
): SellerMenuState {
  if (!farmer) return role === "SELLER" ? "incomplete" : "buyer";
  switch (farmer.verificationStatus) {
    case "APPROVED":
      return "approved";
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return "pending";
    case "REJECTED":
      return "rejected";
    case "RESUBMISSION_REQUIRED":
      return "changes";
    case "NOT_STARTED":
    case "DRAFT":
      return "incomplete";
    default:
      return "unknown";
  }
}
