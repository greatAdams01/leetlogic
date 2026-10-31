import * as Location from "expo-location";

import { savedFarmPoint, type FarmPoint } from "./farm-location";
import { normalizeNigerianState } from "../../../../packages/contracts/src/addresses";
import { localGovernments } from "./locations";
export { savedFarmPoint, type FarmPoint } from "./farm-location";
export async function captureFarmPosition(context: "farm" | "buyer" = "farm") {
  const fail = (farm: string, buyer: string) => new Error(context === "buyer" ? buyer : farm);
  if (!(await Location.hasServicesEnabledAsync()))
    throw new Error("Turn on your device’s location services and try again.");
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted")
    throw fail(
      "Location access was not allowed. Enable it in Settings or choose your farm on the map.",
      "Location access was not allowed. Choose an area below or enable location in Settings.",
    );
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => {
        throw fail(
          "We couldn’t read your location. Check location permissions and try again outdoors, or choose a point on the map.",
          "We couldn’t read your location. Try again outdoors or choose an area below.",
        );
      }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              fail(
                "We couldn’t find your location in time. Move outdoors and try again, or choose your farm on the map.",
                "We couldn’t find your location in time. Try again or choose an area below.",
              ),
            ),
          20000,
        );
      }),
    ]);
    const point = savedFarmPoint(result.coords);
    if (
      !point ||
      !Number.isFinite(result.timestamp) ||
      Date.now() - result.timestamp > 60000 ||
      result.timestamp > Date.now() + 10000
    )
      throw fail(
        "Your location could not be confirmed. Try again outdoors or choose your farm on the map.",
        "Your location could not be confirmed. Try again or choose an area below.",
      );
    return { point, accuracy: result.coords.accuracy };
  } finally {
    clearTimeout(timeout);
  }
}

export async function describePosition(point: FarmPoint) {
  const [place] = await Location.reverseGeocodeAsync(point);
  const state = place?.region ? normalizeNigerianState(place.region) : undefined;
  const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const candidate = place?.district || place?.subregion;
  const lga = state && candidate ? localGovernments(state).find((name) => normalize(name) === normalize(candidate)) : undefined;
  return place
    ? {
        ...([place.name, place.street].filter(Boolean).length ? { line1: [place.name, place.street].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(", ") } : {}),
        ...(place.city || place.subregion ? { city: place.city || place.subregion! } : {}),
        ...(lga ? { lga } : {}),
        ...(state ? { state } : {}),
      }
    : null;
}
