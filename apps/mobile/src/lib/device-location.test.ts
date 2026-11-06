import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("expo-location", () => ({
  hasServicesEnabledAsync: vi.fn(),
  requestForegroundPermissionsAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
  Accuracy: { High: 4 },
  reverseGeocodeAsync: vi.fn(),
}));
import * as Location from "expo-location";
import { captureFarmPosition, savedFarmPoint, describePosition } from "./device-location";
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
  vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
    status: "granted",
  } as never);
});
afterEach(() => vi.useRealTimers());
describe("farm device location", () => {
  it("captures a fresh foreground fix and retains its accuracy", async () => {
    vi.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
      timestamp: Date.now(),
      coords: { latitude: 6.52, longitude: 3.37, accuracy: 12 },
    } as never);
    expect(await captureFarmPosition()).toEqual({
      point: { latitude: 6.52, longitude: 3.37 },
      accuracy: 12,
    });
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({
      accuracy: Location.Accuracy.High,
    });
  });
  it("does not read coordinates when location services or permission are off", async () => {
    vi.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(false);
    await expect(captureFarmPosition()).rejects.toThrow("Turn on");
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    vi.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
    vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
      status: "denied",
    } as never);
    await expect(captureFarmPosition()).rejects.toThrow("Location access was not allowed");
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });
  it("rejects stale fixes and times out without silently using an old position", async () => {
    vi.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
      timestamp: Date.now() - 120000,
      coords: { latitude: 6, longitude: 3, accuracy: 10 },
    } as never);
    await expect(captureFarmPosition()).rejects.toThrow("could not be confirmed");
    vi.useFakeTimers();
    vi.mocked(Location.getCurrentPositionAsync).mockReturnValue(new Promise(() => {}));
    const captured = captureFarmPosition();
    const check = expect(captured).rejects.toThrow("in time");
    await vi.advanceTimersByTimeAsync(20000);
    await check;
  });
  it("does not turn missing or malformed saved coordinates into a valid pin", () => {
    expect(savedFarmPoint({ latitude: null, longitude: null })).toBeUndefined();
    expect(savedFarmPoint({ latitude: 6, longitude: 181 })).toBeUndefined();
    expect(savedFarmPoint({ latitude: "NaN", longitude: 3 })).toBeUndefined();
    expect(savedFarmPoint({ latitude: "6.520000", longitude: "3.370000" })).toEqual({
      latitude: 6.52,
      longitude: 3.37,
    });
  });
});

it("gives buyers a manual-area fallback when location permission is denied", async () => {
  vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
    status: "denied",
  } as never);
  await expect(captureFarmPosition("buyer")).rejects.toThrow("Choose an area below");
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});

it("resolves street number, city, state, postcode and a valid LGA even when district is a neighbourhood", async () => {
  vi.mocked(Location.reverseGeocodeAsync).mockResolvedValue([
    {
      name: "A nearby shop",
      streetNumber: "25",
      street: "Market Road",
      city: "Ikeja",
      region: "Lagos",
      district: "Some neighbourhood",
      subregion: "Ikeja",
      postalCode: "100001",
    },
  ] as never);
  expect(await describePosition({ latitude: 6.6, longitude: 3.3 })).toMatchObject({
    line1: "25 Market Road",
    city: "Ikeja",
    state: "Lagos",
    lga: "Ikeja",
    postalCode: "100001",
  });
});
it.each(["Ikeja LGA", "Ikeja Local Government", "Ikeja Local Government Area"])(
  "normalizes native state and local-government suffixes (%s)", async district => {
    vi.mocked(Location.reverseGeocodeAsync).mockResolvedValue([{
      street: "Market Road", streetNumber: "25", city: "Oregun", region: " Lagos State ",
      district: ` ${district} `,
    }] as never);
    expect(await describePosition({ latitude: 6.6, longitude: 3.3 })).toMatchObject({
      line1: "25 Market Road", city: "Oregun", state: "Lagos", lga: "Ikeja",
    });
  },
);
it("does not invent a local government area from an unknown geocoded neighbourhood", async () => {
  vi.mocked(Location.reverseGeocodeAsync).mockResolvedValue([{
    city: "Oregun", district: "Unknown neighbourhood", region: "Lagos", postalCode: "not-a-postcode",
  }] as never);
  expect(await describePosition({ latitude: 6.6, longitude: 3.3 })).toEqual({ city: "Oregun", state: "Lagos" });
});
