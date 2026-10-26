import { quantity, toMinor } from "./domain";
import {
  emptyPacking,
  packingFields,
  packingValue,
  packingError,
  type PackingFields,
} from "./packaging";
export type ListingPhoto = { id: string; uri?: string };
export type ListingForm = {
  packaging?: PackingFields;
  title: string;
  description: string;
  categoryId: string;
  unitCode: string;
  quantity: string;
  price: string;
  addressId: string;
  shippingScope: "LOCAL" | "NATIONWIDE";
  photos: ListingPhoto[];
};
export type ListingUnit = { code: string; allowsDecimal: boolean };
export const emptyListing: ListingForm = {
  packaging: emptyPacking,
  title: "",
  description: "",
  categoryId: "",
  unitCode: "",
  quantity: "",
  price: "",
  addressId: "",
  shippingScope: "NATIONWIDE",
  photos: [],
};
export function restoreListing(input: any): ListingForm {
  const photos: ListingPhoto[] = Array.isArray(input.photos)
    ? input.photos
    : (input.photoIds || (input.photoId ? [input.photoId] : [])).map((id: string) => ({ id }));
  const price =
    input.price ??
    (input.unitPriceMinor
      ? `${BigInt(input.unitPriceMinor) / 100n}.${String(BigInt(input.unitPriceMinor) % 100n).padStart(2, "0")}`
      : "");
  return {
    ...emptyListing,
    ...input,
    price,
    packaging: packingFields(input.packaging),
    photos: photos
      .filter((p, i, all) => typeof p?.id === "string" && all.findIndex((x) => x.id === p.id) === i)
      .slice(0, 4),
  };
}
export function listingDetailsError(form: ListingForm, units: ListingUnit[]): string {
  if (form.title.trim().length < 2) return "Enter a product title with at least two characters.";
  if (!form.description.trim()) return "Describe your produce before continuing.";
  if (form.description.length > 5000) return "Keep the description within 5,000 characters.";
  const unit = units.find((item) => item.code === form.unitCode);
  if (!unit) return "Choose a selling unit.";
  try {
    quantity(form.quantity);
  } catch {
    return "Enter a positive quantity with at most three decimal places.";
  }
  if (!unit.allowsDecimal && !/^\d+$/.test(form.quantity))
    return "Enter a whole quantity for this selling unit.";
  try {
    toMinor(form.price);
  } catch {
    return "Enter a price in naira with at most two decimal places.";
  }
  if (!form.addressId) return "Complete your farm address before listing produce.";
  const packing = packingError(form.packaging);
  if (packing) return packing;
  if (!unit.allowsDecimal && !Number.isInteger(Number(form.packaging?.unitsPerPackage)))
    return "Enter whole selling units in each package.";
  if (
    form.unitCode === "KG" &&
    Number(form.packaging?.weightKg) < Number(form.packaging?.unitsPerPackage)
  )
    return "Packed weight must include the produce weight and its packaging.";
  return "";
}
export function listingPayload(form: ListingForm, locale: string) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    categoryId: form.categoryId,
    unitCode: form.unitCode,
    quantity: quantity(form.quantity),
    unitPriceMinor: toMinor(form.price),
    addressId: form.addressId,
    sourceLocale: locale,
    shippingScope: form.shippingScope,
    packaging: packingValue(form.packaging || emptyPacking),
    photoIds: form.photos.map((photo) => photo.id),
    photoId: form.photos[0]?.id,
  };
}
export function moveCover(photos: ListingPhoto[], id: string) {
  const selected = photos.find((photo) => photo.id === id);
  return selected ? [selected, ...photos.filter((photo) => photo.id !== id)] : photos;
}
