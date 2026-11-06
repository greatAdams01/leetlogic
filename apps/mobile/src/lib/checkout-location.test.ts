import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ api: vi.fn(), describe: vi.fn() }));
vi.mock("./api", () => ({ api: h.api }));
vi.mock("./device-location", () => ({ describePosition: h.describe }));
import { resolveCheckoutLocation } from "./checkout-location";
const point = { latitude: 6.6, longitude: 3.3 };
const fields = { line1: "25 Market Road", city: "Ikeja", state: "Lagos", lga: "Ikeja" };
const lookup = {
  postcode: "LA-02-A09-DB-09",
  valid: true,
  mode: "TEST",
  level: 2,
  fields,
  addressDetailsAvailable: true,
  verificationToken: "proof",
};
beforeEach(() => {
  vi.clearAllMocks();
  h.api.mockReset();
  h.describe.mockResolvedValue(fields);
});
afterEach(() => vi.useRealTimers());
it("does not request a digital code when the device has already resolved a complete address", async () => {
  h.api.mockResolvedValue({ found: false });
  expect(await resolveCheckoutLocation(point)).toMatchObject({ details: fields });
  expect(h.api).not.toHaveBeenCalled();
});
it("keeps the map address usable when no nearby digital code exists", async () => {
  h.describe.mockResolvedValue({ line1: fields.line1, city: fields.city, state: fields.state });
  h.api.mockResolvedValue({ found: false });
  expect(await resolveCheckoutLocation(point)).toMatchObject({
    details: { line1: fields.line1, city: fields.city, state: fields.state, lga: "", postalCode: "" },
    verificationToken: null,
  });
  expect(h.api).toHaveBeenCalledOnce();
});
it("treats a postcode provider outage as optional enrichment, not an address failure", async () => {
  h.describe.mockResolvedValue({ state: fields.state });
  h.api.mockRejectedValue(new Error("Unavailable"));
  expect(await resolveCheckoutLocation(point)).toMatchObject({
    details: { state: fields.state },
    verificationToken: null,
  });
});
it("fills missing geocoded details from a matching nearby verified code", async () => {
  h.describe.mockResolvedValue({ state: "Lagos" });
  h.api
    .mockResolvedValueOnce({
      found: true,
      candidate: { postcode: lookup.postcode, distanceM: 5, confidence: "high" },
    })
    .mockResolvedValueOnce(lookup);
  expect(await resolveCheckoutLocation(point)).toMatchObject({
    details: { ...fields, postalCode: lookup.postcode },
    verificationToken: "proof",
  });
  expect(h.api).toHaveBeenCalledWith(
    "/me/postcodes/lookup",
    expect.objectContaining({ body: { code: lookup.postcode } }),
  );
});
it("does not replace the pin’s resolved street with a conflicting postcode address", async () => {
  h.describe.mockResolvedValue({ line1: fields.line1, city: fields.city, state: fields.state });
  h.api
    .mockResolvedValueOnce({
      found: true,
      candidate: { postcode: lookup.postcode, distanceM: 5, confidence: "high" },
    })
    .mockResolvedValueOnce({ ...lookup, fields: { ...fields, line1: "A different street" } });
  expect(await resolveCheckoutLocation(point)).toMatchObject({
    details: { line1: fields.line1, city: fields.city, state: fields.state, lga: "", postalCode: "" },
    verificationToken: null,
  });
});
it("does not invent missing street or area details when both providers lack them", async () => {
  h.describe.mockResolvedValue({ state: "Lagos", city: "Ikeja" });
  h.api.mockResolvedValue({ found: false });
  expect((await resolveCheckoutLocation(point)).details).toMatchObject({
    line1: "",
    lga: "",
    state: "Lagos",
    city: "Ikeja",
  });
});
it("falls back to missing-detail entry when native reverse geocoding never finishes", async () => {
  vi.useFakeTimers();
  h.describe.mockReturnValue(new Promise(() => {}));
  h.api.mockResolvedValue({ found: false });
  const result = resolveCheckoutLocation(point);
  await vi.advanceTimersByTimeAsync(3000);
  expect(await result).toMatchObject({
    details: { line1: "", city: "", state: "", lga: "" },
    verificationToken: null,
  });
});
it.each(["medium", "low"])("does not use a %s-confidence nearby code as an address", async confidence => {
  h.describe.mockResolvedValue({ state: "Lagos" });
  h.api.mockResolvedValue({ found: true, candidate: { postcode: lookup.postcode, distanceM: 5, confidence } });
  expect(await resolveCheckoutLocation(point)).toMatchObject({ details: { line1: "", state: "Lagos" }, verificationToken: null });
  expect(h.api).toHaveBeenCalledOnce();
});
it.each([
  null,
  { found: true },
  { found: true, candidate: { postcode: lookup.postcode, distanceM: 26, confidence: "high" } },
  { found: true, candidate: { postcode: "not-a-code", distanceM: 5, confidence: "high" } },
])("ignores malformed nearby-code responses (%j)", async response => {
  h.describe.mockResolvedValue({ state: "Lagos" });
  h.api.mockResolvedValue(response);
  expect(await resolveCheckoutLocation(point)).toMatchObject({ details: { line1: "", state: "Lagos" }, verificationToken: null });
  expect(h.api).toHaveBeenCalledOnce();
});
it.each([
  { ...lookup, verificationToken: undefined },
  { ...lookup, postcode: "LA-02-A09-DB-10" },
  { ...lookup, valid: false },
  { ...lookup, fields: { ...fields, city: 42 } },
])("does not apply unsigned, mismatched or malformed lookup details (%j)", async response => {
  h.describe.mockResolvedValue({ state: "Lagos" });
  h.api.mockResolvedValueOnce({ found: true, candidate: { postcode: lookup.postcode, distanceM: 5, confidence: "high" } })
    .mockResolvedValueOnce(response);
  expect(await resolveCheckoutLocation(point)).toMatchObject({ details: { line1: "", state: "Lagos", postalCode: "" }, verificationToken: null });
});
it.each(["reverse", "lookup"])("bounds an unresponsive %s provider and ignores its late response", async action => {
  vi.useFakeTimers();
  h.describe.mockResolvedValue({ state: "Lagos", postalCode: "100001" });
  let finish!: (value: unknown) => void;
  const stalled = new Promise(resolve => { finish = resolve; });
  if (action === "lookup") h.api.mockResolvedValueOnce({
    found: true, candidate: { postcode: lookup.postcode, distanceM: 5, confidence: "high" },
  }).mockReturnValueOnce(stalled);
  else h.api.mockReturnValueOnce(stalled);
  const pending = resolveCheckoutLocation(point);
  await vi.advanceTimersByTimeAsync(3000);
  const result = await pending;
  expect(result).toMatchObject({ details: { state: "Lagos", line1: "", postalCode: "100001" }, verificationToken: null });
  finish(action === "lookup" ? lookup : { found: true, candidate: { postcode: lookup.postcode, distanceM: 5, confidence: "high" } });
  await vi.advanceTimersByTimeAsync(0);
  expect(result.details.line1).toBe("");
  expect(h.api).toHaveBeenCalledTimes(action === "lookup" ? 2 : 1);
});
it("keeps the device’s six-digit postal reference without a digital-code request", async () => {
  h.describe.mockResolvedValue({ ...fields, postalCode: "100001" });
  expect(await resolveCheckoutLocation(point)).toMatchObject({ details: { ...fields, postalCode: "100001" }, verificationToken: null });
  expect(h.api).not.toHaveBeenCalled();
});
