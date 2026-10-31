import { addressInstructions, addressText } from "../../../../packages/contracts/src/addresses";
import type { Address } from "./domain";
import { savedFarmPoint } from "./farm-location";

export function checkoutAddress(address: Address) {
  const point = savedFarmPoint(address);
  return { addressId: address.id, address: addressText(address), state: address.state,
    postalCode: address.postalCode || null, instructions: addressInstructions(address),
    latitude: point?.latitude, longitude: point?.longitude };
}
