import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../config.js", () => ({
  getConfig: () => ({
    DELIVERY_ENABLED: true,
    DELIVERY_MAX_WEIGHT_KG: 1000,
    SHIPBUBBLE_API_KEY: "test-key",
    SHIPBUBBLE_MODE: "test",
    SHIPBUBBLE_TEST_KEY_CONFIRMED: true,
    SHIPBUBBLE_CATEGORY_ID: 1,
  }),
}));
import { Shipbubble } from "./shipbubble.js";
describe("Shipbubble protocol", () => {
  const fetcher = vi.fn();
  const provider = new Shipbubble(fetcher as typeof fetch);
  const contact = {
    name: "Farmer",
    email: "farmer@example.test",
    phone: "+2348012345678",
    address: "12 Example Road Lagos",
    state: "Lagos",
    country: "NG" as const,
  };
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T09:00:00Z"));
    fetcher.mockReset();
  });
  afterEach(() => vi.useRealTimers());
  it("sends supported confirmed map pins and a complete address to Shipbubble", async () => {
    fetcher.mockResolvedValue(Response.json({ status: "success", data: { address_code: 1 } }));
    await provider.validateAddress({ ...contact, latitude: 6.52, longitude: 3.37 });
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({
      name: contact.name, email: contact.email, phone: contact.phone,
      address: `${contact.address}, Nigeria`,
      latitude: 6.52,
      longitude: 3.37,
    });
  });
  it("includes state and country for addresses without a map pin", async () => {
    fetcher.mockResolvedValue(Response.json({ status: "success", data: { address_code: 1 } }));
    await provider.validateAddress({
      ...contact,
      address: "74 Aluu Road Rumuekini",
      state: "Rivers",
    });
    expect(JSON.parse(fetcher.mock.calls[0]![1].body).address).toBe(
      "74 Aluu Road Rumuekini, Rivers, Nigeria",
    );
  });
  it("reports an invalid destination separately from a provider failure", async () => {
    fetcher
      .mockResolvedValueOnce(Response.json({ status: "success", data: { address_code: 1 } }))
      .mockResolvedValueOnce(
        Response.json({ status: "failed", message: "private provider detail" }, { status: 400 }),
      );
    await expect(
      provider.quotes({
        pickup: contact,
        destination: contact,
        parcel: {
          weightKg: 10,
          length: 20,
          width: 10,
          height: 20,
          pickupDate: "2026-11-01",
          handling: "STANDARD",
        },
        name: "Flour",
        valueMinor: 10000n,
      }),
    ).rejects.toMatchObject({ status: 422, code: "DESTINATION_ADDRESS_INVALID" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("uses address validation and VAT-inclusive pickup quotes only", async () => {
    fetcher
      .mockResolvedValueOnce(Response.json({ status: "success", data: { address_code: 1 } }))
      .mockResolvedValueOnce(Response.json({ status: "success", data: { address_code: 2 } }))
      .mockResolvedValueOnce(
        Response.json({
          status: "success",
          data: {
            request_token: "token",
            couriers: [
              {
                courier_id: "test-courier",
                service_code: "pickup",
                courier_name: "Courier",
                ratings: 4.5,
                votes: 80,
                tracking_level: 8,
                total: 120.5,
                service_type: "pickup",
                delivery_eta: "Tomorrow",
              },
              {
                courier_id: "drop-courier",
                service_code: "drop",
                courier_name: "Station",
                total: 50,
                service_type: "dropoff",
              },
            ],
          },
        }),
      );
    const quotes = await provider.quotes({
      pickup: contact,
      destination: { ...contact, address: "42 Buyer Road Abuja", state: "FCT" },
      parcel: {
        weightKg: 2,
        length: 10,
        width: 10,
        height: 10,
        pickupDate: "2026-11-01",
        handling: "STANDARD",
        notes: "Keep upright and away from sunlight",
      },
      name: "Produce",
      valueMinor: 50000n,
    });
    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.amountMinor).toBe(12050n);
    expect(quotes[0]?.quality).toEqual({ rating: 4.5, votes: 80, trackingLevel: 8 });
    expect(JSON.parse(fetcher.mock.calls[2]![1].body)).toMatchObject({
      sender_address_code: 1,
      reciever_address_code: 2,
      package_items: [
        {
          quantity: 1,
          unit_amount: 500,
          unit_weight: 2,
          description: "Produce · Keep upright and away from sunlight",
        },
      ],
      package_dimension: { length: 10, width: 10, height: 10 },
    });
  });
  it("never submits separate parcels or special handling as one standard parcel", async () => {
    for (const parcel of [
      { packageCount: 1, handling: "COLD_CHAIN" as const, length: 10 },
      { packageCount: 1, handling: "STANDARD" as const, length: 250 },
    ])
      await expect(
        provider.quotes({
          pickup: contact,
          destination: contact,
          parcel: { weightKg: 2, width: 10, height: 10, pickupDate: "2026-11-01", ...parcel },
          name: "Produce",
          valueMinor: 50000n,
        }),
      ).rejects.toMatchObject({ code: parcel.handling === "STANDARD" ? "SHIPMENT_TOO_LARGE" : "SHIPMENT_HANDLING_UNSUPPORTED" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("quotes two 50.5 kg rice bags separately without inventing a combined box", async () => {
    let calls = 0;
    fetcher.mockImplementation(async (url) => {
      if (url.endsWith("/shipping/address/validate"))
        return Response.json({ status: "success", data: { address_code: ++calls } });
      return Response.json({
        status: "success",
        data: {
          request_token: `part-${++calls}`,
          couriers: [
            {
              courier_id: "freight",
              courier_name: "Freight",
              service_code: "freight",
              service_type: "pickup",
              currency: "NGN",
              total: 2000,
              delivery_eta: "1 day",
            },
          ],
        },
      });
    });
    const quotes = await provider.quotes({
      pickup: contact,
      destination: contact,
      name: "Rice",
      valueMinor: 1000000n,
      parcel: {
        packageCount: 2,
        weightKg: 101,
        length: 80,
        width: 50,
        height: 25,
        pickupDate: "2026-11-01",
        handling: "STANDARD",
        notes: "Keep dry",
      },
    });
    expect(quotes[0]!.amountMinor).toBe(400000n);
    const requests = fetcher.mock.calls
      .filter(([url]) => url.endsWith("/shipping/fetch_rates"))
      .map(([, options]) => JSON.parse(options.body));
    expect(requests).toHaveLength(2);
    for (const input of requests)
      expect(input).toMatchObject({
        package_items: [{ unit_weight: 50.5, unit_amount: 5000, quantity: 1 }],
        package_dimension: { length: 80, width: 50, height: 25 },
        delivery_instructions: "Keep dry",
        service_type: "pickup",
      });
    expect(quotes[0]!.requestToken).toMatch(/^split:/);
  });
  it("creates labels using the stored request token and service code", async () => {
    fetcher.mockResolvedValue(
      Response.json({
        status: "success",
        data: {
          order_id: "SB-123",
          status: "pending",
          tracking_url: "https://example.test/track",
          courier: { name: "Courier" },
        },
      }),
    );
    await expect(
      provider.book({ requestToken: "token", serviceCode: "courier", courierId: "test-courier" }),
    ).resolves.toMatchObject({ id: "SB-123" });
    expect(fetcher.mock.calls[0]![0]).toBe("https://api.shipbubble.com/v1/shipping/labels");
  });
  it("reads the prepaid wallet balance in kobo", async () => {
    fetcher.mockResolvedValue(
      Response.json({ status: "success", data: { balance: 80124.2, country_code: "NG" } }),
    );
    expect(await provider.wallet()).toBe(8012420n);
    expect(fetcher.mock.calls[0]![0]).toBe("https://api.shipbubble.com/v1/shipping/wallet/balance");
  });
  it("propagates failures without issuing a second booking", async () => {
    fetcher.mockRejectedValue(new Error("timeout"));
    await expect(
      provider.book({ requestToken: "token", serviceCode: "courier", courierId: "test-courier" }),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
