import React from "react";
import * as testRenderer from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ api: vi.fn(), write: vi.fn(), remove: vi.fn(), identity: 1 }));
vi.mock("react-native", () => ({
  View: "View",
  Image: "Image",
  ActivityIndicator: "ActivityIndicator",
  Pressable: "Pressable",
}));
vi.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache" },
  File: class {
    uri = "file:///cache/preview.jpg";
    exists = true;
    create = vi.fn();
    write = h.write;
    delete = h.remove;
  },
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => "preview" }));
vi.mock("./api", () => ({ api: h.api, sessionVersion: () => h.identity }));
vi.mock("../state", () => ({ useApp: () => ({ ui: (s: string) => s }) }));
vi.mock("../components/ui", () => ({
  Icon: "Icon",
  Label: "Label",
  colors: { mint: "white", green: "green" },
}));
import { ListingPhoto } from "../components/listing-photo";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let renderer: testRenderer.ReactTestRenderer;
const item: any = {
  title: "Tomatoes",
  media: [{ objectKey: "produce/11111111-1111-4111-8111-111111111111" }],
};
beforeEach(() => {
  vi.clearAllMocks();
  h.api.mockResolvedValue({ bytes: new Uint8Array([255, 216, 255]), mime: "image/jpeg" });
});
afterEach(async () => {
  if (renderer) await testRenderer.act(async () => renderer.unmount());
});
describe("mobile listing photo preview", () => {
  it("loads through authenticated API and displays an actual local image on compact seller cards", async () => {
    await testRenderer.act(async () => {
      renderer = testRenderer.create(<ListingPhoto item={item} height={80} />);
    });
    expect(h.api).toHaveBeenCalledWith("/listing-photos/11111111-1111-4111-8111-111111111111", {
      imageResponse: true,
    });
    expect(h.write).toHaveBeenCalledWith(new Uint8Array([255, 216, 255]));
    expect(renderer.root.findByType("Image" as never).props.source.uri).toBe(
      "file:///cache/preview.jpg",
    );
  });
  it("loads the selected gallery photo in full without cropping", async () => {
    const objectKey = "produce/22222222-2222-4222-8222-222222222222";
    await testRenderer.act(async () => {
      renderer = testRenderer.create(
        <ListingPhoto item={item} objectKey={objectKey} resizeMode="contain" />,
      );
    });
    expect(h.api).toHaveBeenCalledWith("/listing-photos/22222222-2222-4222-8222-222222222222", {
      imageResponse: true,
    });
    expect(renderer.root.findByType("Image" as never).props.resizeMode).toBe("contain");
  });
  it("shows a retry action instead of a blank box when storage cannot be reached", async () => {
    h.api.mockRejectedValueOnce(new Error("storage unavailable"));
    await testRenderer.act(async () => {
      renderer = testRenderer.create(<ListingPhoto item={item} />);
    });
    expect(renderer.root.findAllByType("Image" as never)).toHaveLength(0);
    h.api.mockResolvedValueOnce({ bytes: new Uint8Array([255, 216, 255]), mime: "image/jpeg" });
    await testRenderer.act(async () =>
      renderer.root.findByType("Pressable" as never).props.onPress(),
    );
    expect(renderer.root.findAllByType("Image" as never)).toHaveLength(1);
  });
  it("ignores a late response after leaving the screen and deletes local previews on exit", async () => {
    let resolve!: (value: unknown) => void;
    h.api.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    await testRenderer.act(async () => {
      renderer = testRenderer.create(<ListingPhoto item={item} />);
    });
    await testRenderer.act(async () => renderer.unmount());
    await testRenderer.act(async () => resolve({ bytes: new Uint8Array([1]), mime: "image/png" }));
    expect(h.write).not.toHaveBeenCalled();
  });
});
