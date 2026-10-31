// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "../../mobile/src/lib/domain";
import type { PostcodeLookup } from "../../../packages/contracts/src/addresses";

const h = vi.hoisted(() => ({ api: vi.fn(), saved: vi.fn() }));
vi.mock("./customer-api", () => ({ customerApi: h.api }));
vi.mock("../components/language-provider", () => ({
  useLanguage: () => ({ locale: "en", t: (key: string) => key }),
}));
vi.mock("../../mobile/src/lib/localization", () => ({
  ui: (_locale: string, text: string) => text,
  localizedError: (_locale: string, value: { code?: string; message?: string }) => value.code || value.message || "Request failed",
}));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
import { CustomerAddresses } from "../components/customer-addresses";
import { ProduceListing } from "../components/produce-listing";

const address: Address = {
  id: "11111111-1111-4111-8111-111111111111", label: "Home", state: "Lagos", lga: "Ikeja",
  city: "Lagos", line1: "24 Community Road", postalCode: "LA-01-A03-FK-01",
  latitude: 6.52, longitude: 3.37, isDefaultDelivery: true,
  postcodeVerifiedAt: "2026-10-31T09:00:00Z", postcodeVerificationLevel: 2, postcodeVerificationMode: "LIVE",
};
const lookup: PostcodeLookup = {
  postcode: "FC-02-A09-DB-09", valid: true, mode: "TEST", level: 2,
  fields: { state: "Federal Capital Territory", lga: "Bwari", city: "Kubwa", line1: "12 Community Road" },
  addressDetailsAvailable: true, verificationToken: "server-issued-proof",
};
const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const change = (label: string, value: string) => fireEvent.change(input(label), { target: { value } });
const click = async (name: string) => { await act(async () => { fireEvent.click(screen.getByRole("button", { name })); }); };
const submit = async () => { await act(async () => { fireEvent.submit(screen.getByRole("form", { name: "Save address" })); }); };
const mount = () => render(<CustomerAddresses addresses={[address]} onSaved={h.saved} />);

beforeEach(() => {
  vi.resetAllMocks();
  h.saved.mockResolvedValue(undefined);
  h.api.mockImplementation(async (path: string) => path === "me/postcodes/lookup" ? lookup : { address });
});
afterEach(cleanup);

describe("web saved addresses and postcode confirmation", () => {
  it("requires review before using postcode fields, clears the old pin, and submits only the proof", async () => {
    mount();
    await click("Edit saved address");
    change("Digital postcode (optional)", lookup.postcode);
    await click("Check postcode");
    expect(input("Full street address").value).toBe(address.line1);
    expect(input("Latitude").value).toBe(String(address.latitude));
    await click("Use these postcode details");
    expect(input("Full street address").value).toBe(lookup.fields.line1);
    expect(input("Latitude").value).toBe("");
    await submit();
    expect(h.api).toHaveBeenLastCalledWith(`me/addresses/${address.id}`, expect.objectContaining({
      ...lookup.fields, postalCode: lookup.postcode, verificationToken: lookup.verificationToken, coordinates: null,
    }), "PATCH", undefined);
    expect(h.api.mock.calls.at(-1)![1]).not.toHaveProperty("postcodeVerifiedAt");
  });
  it("clears the old LGA when a validity-only lookup supplies a different state", async () => {
    h.api.mockResolvedValueOnce({ ...lookup, level: 1, fields: { state: lookup.fields.state }, addressDetailsAvailable: false });
    mount();
    await click("Edit saved address");
    change("Digital postcode (optional)", lookup.postcode);
    await click("Check postcode");
    await click("Use these postcode details");
    expect(input("State").value).toBe("Federal Capital Territory");
    expect(input("Local government area").value).toBe("");
    expect(input("Full street address").value).toBe(address.line1);
  });
  it("retains verification on label-only edits and invalidates it on address edits", async () => {
    mount();
    await click("Edit saved address");
    change("Address label", "My home");
    await submit();
    expect(h.api).toHaveBeenLastCalledWith(`me/addresses/${address.id}`, expect.objectContaining({
      label: "My home", verificationToken: undefined, coordinates: { latitude: 6.52, longitude: 3.37 },
    }), "PATCH", undefined);
    await click("Edit saved address");
    change("Full street address", "25 Different Road");
    await submit();
    expect(h.api).toHaveBeenLastCalledWith(`me/addresses/${address.id}`, expect.objectContaining({
      verificationToken: null, coordinates: null,
    }), "PATCH", undefined);
  });
  it("keeps a provider outage non-blocking for manual address entry", async () => {
    h.api.mockRejectedValueOnce({ code: "POSTCODE_SERVICE_UNAVAILABLE" });
    mount();
    await click("Edit saved address");
    await click("Check postcode");
    expect(screen.getByRole("alert").textContent).toBe("POSTCODE_SERVICE_UNAVAILABLE");
    await click("Enter address manually");
    await submit();
    expect(h.api).toHaveBeenLastCalledWith(`me/addresses/${address.id}`, expect.objectContaining({ verificationToken: null }), "PATCH", undefined);
  });
  it("does not save an unconfirmed or incomplete map pin", async () => {
    mount();
    await click("Edit saved address");
    change("Latitude", "6.53");
    await submit();
    expect(h.api).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("ADDRESS_PIN_CONFIRMATION_REQUIRED");
    fireEvent.click(screen.getByLabelText("I confirm this map pin identifies my address."));
    await submit();
    expect(h.api.mock.calls.at(-1)![1].coordinates).toEqual({ latitude: 6.53, longitude: 3.37 });
  });
  it("coalesces saves and retains the idempotency key after a lost response", async () => {
    let reject!: (reason: unknown) => void;
    h.api.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    mount();
    change("Address label", "Rural pickup");
    change("Full street address", "Plot 8 Community Road");
    change("City / town", "Ogbia");
    change("State", "Bayelsa");
    change("Local government area", "Ogbia");
    await submit();
    await submit();
    expect(h.api).toHaveBeenCalledOnce();
    const key = h.api.mock.calls[0]![3];
    expect(key).toMatch(/^[\da-f-]{36}$/);
    await act(async () => reject({ code: "NETWORK_ERROR" }));
    await submit();
    expect(h.api.mock.calls[1]![3]).toBe(key);
    expect(h.saved).toHaveBeenCalledOnce();
  });
  it("lists all 36 states and the FCT without a courier coverage allowlist", () => {
    mount();
    const select = input("State") as unknown as HTMLSelectElement;
    expect(select.options).toHaveLength(38);
    expect([...select.options].map((option) => option.value)).toContain("Federal Capital Territory");
  });
});

it("reloads listing pickup addresses without remounting or erasing the entered produce fields", async () => {
  const catalogue = { verificationStatus: "APPROVED", categories: [{ id: "grains", slug: "grains", translations: [] }], units: [], addresses: [address] };
  h.api.mockResolvedValue(catalogue);
  await act(async () => { render(<ProduceListing />); });
  const field = (name: string) => document.querySelector(`[name="${name}"]`) as HTMLInputElement;
  await click("Type my listing");
  fireEvent.change(field("categoryId"), { target: { value: "grains" } });
  await click("Continue");
  fireEvent.change(field("description"), { target: { value: "Freshly harvested beans" } });
  fireEvent.change(field("addressId"), { target: { value: address.id } });
  fireEvent.change(field("shippingScope"), { target: { value: "LOCAL" } });
  fireEvent.change(field("weightKg"), { target: { value: "50.5" } });
  const form = field("description").form;
  await click("Reload saved addresses");
  expect(field("description").form).toBe(form);
  expect(field("description").value).toBe("Freshly harvested beans");
  expect(field("addressId").value).toBe(address.id);
  expect(field("shippingScope").value).toBe("LOCAL");
  expect(field("weightKg").value).toBe("50.5");
});
