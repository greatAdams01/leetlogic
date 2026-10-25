import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  bytes: vi.fn(),
  permission: vi.fn(),
  camera: vi.fn(),
  library: vi.fn(),
  write: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: h.permission,
  requestMediaLibraryPermissionsAsync: h.permission,
  launchCameraAsync: h.camera,
  launchImageLibraryAsync: h.library,
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => "test-photo" }));
vi.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache" },
  File: class {
    uri = "file:///cache/produce-test-photo.jpg";
    name = "produce-test-photo.jpg";
    size = 6;
    exists = true;
    create = h.create;
    write = h.write;
    delete = h.remove;
    bytes = h.bytes;
  },
}));
import { choosePhoto, photoBody } from "./produce-photo";
beforeEach(() => {
  vi.clearAllMocks();
  h.bytes.mockResolvedValue(new Uint8Array([255, 216, 255, 224, 0, 1]));
  h.permission.mockResolvedValue({ granted: true });
  h.library.mockResolvedValue({
    canceled: false,
    assets: [
      { uri: "file:///photo.heic", mimeType: "image/heic", base64: "/9j/AAAA", fileSize: 20000000 },
    ],
  });
  h.camera.mockImplementation(h.library);
});
afterEach(() => vi.unstubAllGlobals());
describe("produce photo preparation", () => {
  it("converts a HEIC source using the picker's JPEG export and never relabels HEIC bytes", async () => {
    const photo = await choosePhoto();
    expect(h.library).toHaveBeenCalledWith(expect.objectContaining({ base64: true, quality: 0.8 }));
    expect(h.write).toHaveBeenCalledWith("/9j/AAAA", { encoding: "base64" });
    expect(photo).toMatchObject({
      uri: "file:///cache/produce-test-photo.jpg",
      mimeType: "image/jpeg",
      fileSize: 6,
    });
    expect(photo?.base64).toBeUndefined();
  });
  it("uses camera export too and cancellation creates no cached file", async () => {
    await choosePhoto(true);
    expect(h.camera).toHaveBeenCalled();
    vi.clearAllMocks();
    h.library.mockResolvedValue({ canceled: true });
    expect(await choosePhoto()).toBeNull();
    expect(h.create).not.toHaveBeenCalled();
  });
  it("rejects invalid exports and oversized converted data before writing a file", async () => {
    for (const base64 of [undefined, "iVBORw0KGgo=", "/9j/" + "A".repeat(14 * 1024 * 1024)]) {
      h.library.mockResolvedValue({ canceled: false, assets: [{ base64 }] });
      await expect(choosePhoto()).rejects.toThrow();
    }
    expect(h.create).not.toHaveBeenCalled();
  });
  it("handles denied permissions without opening the picker", async () => {
    h.permission.mockResolvedValue({ granted: false });
    await expect(choosePhoto()).rejects.toThrow("Photo access was denied");
    expect(h.library).not.toHaveBeenCalled();
  });
  it("removes a partial file when device storage fails", async () => {
    h.write.mockImplementationOnce(() => {
      throw new Error("disk full");
    });
    await expect(choosePhoto()).rejects.toThrow("couldn’t prepare");
    expect(h.remove).toHaveBeenCalled();
  });
  it("reads file bytes directly without invoking fetch, Blob or FileReader", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    vi.stubGlobal(
      "Blob",
      class {
        constructor() {
          throw new Error("Legacy Blob must not be used");
        }
      },
    );
    const body = await photoBody("file:///cache/produce-test-photo.jpg", "image/jpeg");
    expect(body.contentType).toBe("image/jpeg");
    expect(body.bytes).toEqual(new Uint8Array([255, 216, 255, 224, 0, 1]));
    expect(fetcher).not.toHaveBeenCalled();
    h.bytes.mockRejectedValue(new Error("file missing"));
    await expect(photoBody("file:///missing.jpg")).rejects.toThrow("Select it again");
  });
});
