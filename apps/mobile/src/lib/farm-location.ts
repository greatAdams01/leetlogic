import type { Address } from "./domain";

export function farmLocation(addresses: Address[], primaryAddressId?: string | null) {
  return (
    addresses.find((address) => address.id === primaryAddressId) ||
    addresses.find((address) => address.isDefaultFarm)
  );
}

export type FarmPoint = { latitude: number; longitude: number };
export function savedFarmPoint(address?: {
  latitude?: string | number | null;
  longitude?: string | number | null;
}): FarmPoint | undefined {
  if (
    address?.latitude == null ||
    address.longitude == null ||
    String(address.latitude).trim() === "" ||
    String(address.longitude).trim() === ""
  )
    return;
  const latitude = Number(address.latitude),
    longitude = Number(address.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return;
  return { latitude, longitude };
}
