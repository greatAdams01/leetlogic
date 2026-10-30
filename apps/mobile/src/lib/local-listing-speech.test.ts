import { beforeEach, afterEach, it, expect, vi } from "vitest";
const h = vi.hoisted(() => ({
  listeners: {} as Record<string, Function>,
  recognition: {
    supportsOnDeviceRecognition: vi.fn(),
    getSupportedLocales: vi.fn(),
    requestPermissionsAsync: vi.fn(),
    start: vi.fn(),
    abort: vi.fn(),
    addListener: vi.fn(),
  },
  speaker: {
    available: vi.fn(),
    speak: vi.fn(),
    stop: vi.fn(),
    englishRecognitionLocales: vi.fn(),
  },
  platform: { OS: "android" },
}));
vi.mock("expo", () => ({
  requireOptionalNativeModule: (name: string) =>
    name === "ExpoSpeechRecognition" ? h.recognition : h.speaker,
}));
vi.mock("react-native", () => ({ Platform: h.platform }));
import { localSpeechAvailable, listenListing, stopListingSpeech } from "./local-listing-speech";
beforeEach(() => {
  vi.clearAllMocks();
  h.listeners = {};
  h.platform.OS = "android";
  h.recognition.supportsOnDeviceRecognition.mockReturnValue(true);
  h.recognition.getSupportedLocales.mockResolvedValue({
    locales: ["en-NG", "en-US", "fr-FR"],
    installedLocales: ["en-US"],
  });
  h.speaker.available.mockResolvedValue(true);
  h.recognition.addListener.mockImplementation((name: string, callback: Function) => {
    h.listeners[name] = callback;
    return { remove: () => delete h.listeners[name] };
  });
});
afterEach(async () => {
  await stopListingSpeech();
  vi.useRealTimers();
});
it("checks installed English models instead of merely advertised locales", async () => {
  expect(await localSpeechAvailable()).toBe("en-US");
  h.recognition.getSupportedLocales.mockResolvedValue({ locales: ["en-US"], installedLocales: [] });
  expect(await localSpeechAvailable()).toBeNull();
  h.speaker.available.mockResolvedValue(false);
  expect(await localSpeechAvailable()).toBeNull();
});
it("checks English recognizers independently of the iOS system language", async () => {
  h.platform.OS = "ios";
  h.recognition.supportsOnDeviceRecognition.mockReturnValue(false);
  h.speaker.englishRecognitionLocales.mockResolvedValue(["en-GB"]);
  expect(await localSpeechAvailable()).toBe("en-GB");
  expect(h.recognition.getSupportedLocales).not.toHaveBeenCalled();
});
it("forces offline recognition without storing audio and accepts final results only", async () => {
  const result = listenListing("en-NG");
  expect(h.recognition.start).toHaveBeenCalledWith(
    expect.objectContaining({
      lang: "en-NG",
      requiresOnDeviceRecognition: true,
      continuous: false,
      recordingOptions: { persist: false },
    }),
  );
  const callback = h.listeners.result!;
  callback({ isFinal: false, results: [{ transcript: "two" }] });
  expect(h.recognition.abort).not.toHaveBeenCalled();
  callback({ isFinal: true, results: [{ transcript: " twenty " }] });
  expect(await result).toBe("twenty");
  expect(Object.keys(h.listeners)).toHaveLength(0);
});
it("bounds recording to thirty seconds and does not retry through the network", async () => {
  vi.useFakeTimers();
  const result = listenListing("en-US");
  const rejected = expect(result).rejects.toThrow("30 seconds");
  await vi.advanceTimersByTimeAsync(30_000);
  await rejected;
  expect(h.recognition.start).toHaveBeenCalledOnce();
  expect(h.recognition.abort).toHaveBeenCalled();
});
it("cancels the pending result and detaches listeners before a late callback", async () => {
  const result = listenListing("en-US"),
    rejected = expect(result).rejects.toThrow("paused"),
    late = h.listeners.result!;
  await stopListingSpeech();
  late({ isFinal: true, results: [{ transcript: "five" }] });
  await rejected;
  expect(Object.keys(h.listeners)).toHaveLength(0);
});
