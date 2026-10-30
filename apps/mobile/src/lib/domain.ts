export function toMinor(value: string): string {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value.trim()))
    throw new Error("Enter a price in naira with at most two decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (amount <= 0n) throw new Error("Price must be greater than zero.");
  return amount.toString();
}
export function money(value: string | number | undefined): string {
  const n = BigInt(value || 0);
  const sign = n < 0n ? "-" : "";
  const amount = n < 0n ? -n : n;
  return `${sign}₦${(amount / 100n).toLocaleString("en-NG")}${amount % 100n ? "." + (amount % 100n).toString().padStart(2, "0") : ""}`;
}
export function quantity(value: string): string {
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(value) || Number(value) <= 0)
    throw new Error("Enter a positive quantity with at most three decimal places.");
  return value;
}
export const statusLabel = (s: string) =>
  s
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (x) => x.toUpperCase());
export const safeHttps = (url: string) => {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
};
import type { Packaging } from "../../../../packages/contracts/src/packaging";
export type Listing = {
  packingAssistanceRequested?: boolean;
  packaging?: Packaging | null;
  distanceKm?: number;
  unit?: { name: string; allowsDecimal: boolean };
  id: string;
  title: string;
  description: string | null;
  categoryId: string;
  sourceLocale: string;
  shippingScope?: "LOCAL" | "NATIONWIDE";
  unitCode: string;
  unitPriceMinor: string;
  availableQuantity: string;
  reservedQuantity: string;
  status: string;
  media: { objectKey: string }[];
  farmerProfile: { farmName: string; verificationStatus: string };
  locationAddress: { state: string; city: string };
};
export type Address = {
  id: string;
  label: string;
  isDefaultFarm?: boolean;
  isDefaultDelivery?: boolean;
  latitude?: string | number | null;
  longitude?: string | number | null;
  state: string;
  city: string;
  lga: string;
  line1: string;
};
export type Customer = {
  id: string;
  phoneE164: string;
  phoneVerifiedAt?: string | null;
  preferredLocale: string;
  profile: { fullName?: string; displayName?: string; email?: string } | null;
  farmerProfile: {
    farmName: string;
    verificationStatus: string;
    primaryAddressId?: string | null;
  } | null;
  addresses: Address[];
};
export type Order = {
  reservationExpiresAt?: string | null;
  id: string;
  reference: string;
  status: string;
  totalMinor: string;
  quantity?: string;
  listing: { title: string; unitCode?: string };
  delivery: { status: string; shippingMinor: string } | null;
};
export type Contact = {
  name: string;
  phone: string;
  email: string;
  address: string;
  state: string;
  country: "NG";
  latitude?: number;
  longitude?: number;
};
export type DeliveryData = {
  order: {
    id: string;
    reference: string;
    status: string;
    title: string;
    description: string;
    listingId: string;
    totalMinor: string;
    isBuyer: boolean;
    suggestedPickup: Contact;
    quantity?: string;
    unitCode?: string;
    packageSuggestion?: {
      farmer: Packaging;
      packageCount: number;
      weightKg: number;
      length: number | null;
      width: number | null;
      height: number | null;
      handling: Packaging["handling"];
      notes: string;
      needsPackedDimensions: boolean;
    } | null;
  };
  delivery: null | {
    id: string;
    status: string;
    shippingMinor: string;
    paidMinor: string;
    selectedQuoteId: string | null;
    trackingUrl: string | null;
    courier: string | null;
    package?: {
      weightKg: number;
      packageCount?: number;
      length: number;
      width: number;
      height: number;
      pickupDate: string;
      handling: string;
      notes?: string;
    } | null;
    destination: Contact;
    quotes: {
      id: string;
      courier: string;
      amountMinor: string;
      eta: string | null;
      quality?: { rating: number | null; votes: number; trackingLevel: number | null };
      recommended?: boolean;
      recommendationReason?: string | null;
      expiresAt: string;
    }[];
    events: { id: string; status: string; source: string; createdAt: string }[];
  };
};
