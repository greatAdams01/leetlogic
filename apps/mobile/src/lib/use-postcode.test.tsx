import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePostcode, type PostcodeControls } from "./use-postcode";
import type { PostcodeLookup } from "../../../../packages/contracts/src/addresses";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const lookup: PostcodeLookup = {
  postcode: "FC-02-A09-DB-09", valid: true, mode: "LIVE", level: 2,
  fields: { state: "Federal Capital Territory", lga: "Bwari", city: "Kubwa", line1: "12 Community Road" },
  addressDetailsAvailable: true, verificationToken: "server-proof",
};
let tree: ReactTestRenderer;
let controls: PostcodeControls;
let result: ReturnType<typeof usePostcode>;
function Probe(props: PostcodeControls) { result = usePostcode(props); return null; }
const mount = async () => { await act(async () => { tree = create(<Probe {...controls} />); }); };
const update = async (changes: Partial<PostcodeControls>) => {
  controls = { ...controls, ...changes };
  await act(async () => { tree.update(<Probe {...controls} />); });
};

beforeEach(() => {
  controls = {
    value: lookup.postcode, revision: "customer:address-one", request: vi.fn().mockResolvedValue(lookup),
    onChange: vi.fn(), onVerified: vi.fn(), onManual: vi.fn(),
  };
});
afterEach(async () => { await act(async () => { tree?.unmount(); }); });

describe("shared postcode request lifecycle", () => {
  it("requires explicit field confirmation and applies a checked result only once", async () => {
    await mount();
    await act(async () => { await result.lookup(); });
    expect(controls.request).toHaveBeenCalledWith("lookup", { code: lookup.postcode });
    expect(controls.onVerified).not.toHaveBeenCalled();
    expect(result.pending).toEqual(lookup);
    await act(async () => { result.confirm(); });
    await act(async () => { result.confirm(); });
    expect(controls.onVerified).toHaveBeenCalledOnce();
    expect(controls.onVerified).toHaveBeenCalledWith(lookup);
  });
  it("coalesces checks before a rerender and ignores a lookup superseded by typing", async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(controls.request).mockReturnValue(new Promise((done) => { resolve = done; }));
    await mount();
    await act(async () => { void result.lookup(); void result.lookup(); });
    expect(controls.request).toHaveBeenCalledOnce();
    expect(result.busy).toBe(true);
    await act(async () => { result.edit("LA-01-A03-FK-01"); });
    await act(async () => { resolve(lookup); });
    expect(result.pending).toBeNull();
    expect(result.busy).toBe(false);
    expect(controls.onVerified).not.toHaveBeenCalled();
  });
  it.each([
    { revision: "customer:address-two" },
    { revision: "another-customer:address-one" },
    { coordinates: { latitude: 9.09, longitude: 7.41 } },
    { disabled: true },
  ])("ignores pending requests after their context changes: %j", async (changes) => {
    let resolve!: (value: unknown) => void;
    vi.mocked(controls.request).mockReturnValue(new Promise((done) => { resolve = done; }));
    await mount();
    await act(async () => { void result.lookup(); });
    await update(changes);
    await act(async () => { resolve(lookup); result.confirm(); });
    expect(result.pending).toBeNull();
    expect(controls.onVerified).not.toHaveBeenCalled();
  });
  it("supports manual entry after provider errors and ignores an abandoned lookup", async () => {
    vi.mocked(controls.request).mockRejectedValueOnce({ code: "POSTCODE_SERVICE_UNAVAILABLE" });
    await mount();
    await act(async () => { await result.lookup(); });
    expect(result.error).toEqual({ code: "POSTCODE_SERVICE_UNAVAILABLE" });
    let resolve!: (value: unknown) => void;
    vi.mocked(controls.request).mockReturnValue(new Promise((done) => { resolve = done; }));
    await act(async () => { void result.lookup(); });
    await act(async () => { result.manual(); });
    await act(async () => { resolve(lookup); });
    expect(controls.onManual).toHaveBeenCalledOnce();
    expect(result.error).toBeNull();
    expect(result.pending).toBeNull();
  });
  it("never treats malformed, mismatched or unsigned lookups as verified", async () => {
    await mount();
    for (const invalid of [
      { ...lookup, verificationToken: undefined },
      { ...lookup, postcode: "LA-01-A03-FK-01" },
      { valid: true, postcode: "bad-code" },
    ]) {
      vi.mocked(controls.request).mockResolvedValueOnce(invalid);
      await act(async () => { await result.lookup(); });
      expect(result.error).toEqual({ code: "POSTCODE_PROVIDER_RESPONSE_INVALID" });
      expect(result.pending).toBeNull();
    }
    vi.mocked(controls.request).mockResolvedValueOnce({ ...lookup, valid: false, verificationToken: undefined });
    await act(async () => { await result.lookup(); });
    expect(result.error).toEqual({ code: "POSTCODE_NOT_FOUND" });
    expect(controls.onVerified).not.toHaveBeenCalled();
  });
  it("rejects an incomplete code without contacting the provider", async () => {
    controls.value = "FC-02";
    await mount();
    await act(async () => { await result.lookup(); });
    expect(result.error).toEqual({ code: "POSTCODE_INVALID_FORMAT" });
    expect(controls.request).not.toHaveBeenCalled();
  });
  it("completes the active autocomplete segment without verifying it", async () => {
    controls.value = "FC-02-A";
    vi.mocked(controls.request).mockResolvedValueOnce({ segment: "district", suggestions: [{ code: "A09" }] });
    await mount();
    await act(async () => { await result.find(); });
    await act(async () => { result.choose("A09"); });
    expect(controls.onChange).toHaveBeenCalledWith("FC-02-A09-");
    expect(controls.onVerified).not.toHaveBeenCalled();
  });
  it("presents reverse-geocoded buildings as candidates, never verified map pins", async () => {
    controls.coordinates = { latitude: 9.08, longitude: 7.4 };
    vi.mocked(controls.request).mockResolvedValueOnce({ found: true, candidate: { postcode: lookup.postcode, distanceM: 12, confidence: "medium" } });
    await mount();
    await act(async () => { await result.reverse(); });
    expect(result.candidate?.postcode).toBe(lookup.postcode);
    expect(result.pending).toBeNull();
    expect(controls.onVerified).not.toHaveBeenCalled();
    expect(controls.request).toHaveBeenCalledWith("reverse", controls.coordinates);
  });
  it("does not apply a result after leaving the postcode screen", async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(controls.request).mockReturnValue(new Promise((done) => { resolve = done; }));
    await mount();
    await act(async () => { void result.lookup(); });
    await act(async () => { tree.unmount(); resolve(lookup); });
    expect(controls.onVerified).not.toHaveBeenCalled();
  });
});
