import {
  addressLocationSchema,
  addressInstructions,
  addressText,
  nigeriaStateSchema,
  postalCodeSchema,
} from "../../../../packages/contracts/src/addresses";
import type { Address, Contact } from "./domain";
import { savedFarmPoint } from "./farm-location";

export function checkoutAddress(address: Address) {
  const point = savedFarmPoint(address);
  return {
    addressId: address.id,
    address: addressText(address),
    state: address.state,
    postalCode: address.postalCode || null,
    instructions: addressInstructions(address),
    latitude: point?.latitude,
    longitude: point?.longitude,
  };
}

export function validCheckoutAddress(address?: Address): address is Address {
  return typeof address?.id === "string" && !!address.id.trim() && addressLocationSchema.safeParse(address).success &&
    addressText(address).trim().length >= 15;
}

export function missingDeliveryContact(contact: Contact) {
  return (["name", "phone", "email"] as const).filter((key) =>
    key === "name"
      ? contact.name.trim().length < 2 || contact.name.trim().length > 120
      : key === "phone"
        ? !/^\+?\d{10,15}$/.test(contact.phone.trim())
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()),
  );
}
export function deliveryLocationReady(contact: Contact) {
  return (
    contact.address.trim().length >= 15 &&
    contact.address.trim().length <= 500 &&
    nigeriaStateSchema.safeParse(contact.state).success &&
    postalCodeSchema.safeParse(contact.postalCode ?? null).success &&
    (contact.instructions?.trim().length || 0) <= 700 &&
    ((contact.latitude === undefined && contact.longitude === undefined) ||
      !!savedFarmPoint(contact))
  );
}
export function deliveryDestinationReady(contact: Contact) {
  return deliveryLocationReady(contact) && !missingDeliveryContact(contact).length;
}
