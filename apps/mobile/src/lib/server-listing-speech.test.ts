import { beforeEach, afterEach, it, expect, vi } from "vitest";
const h = vi.hoisted(() => ({
  api: vi.fn(),
  mode: vi.fn(),
  permission: vi.fn(),
  deleted: vi.fn(),
  released: vi.fn(),
  stopped: vi.fn(),
  voices: vi.fn(),
  speak: vi.fn(),
  speechStop: vi.fn(),
  meter: -60,
  recorders: [] as any[],
  fileSize: 128,
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-audio", () => ({
  AudioModule: {
    requestRecordingPermissionsAsync: h.permission,
    AudioRecorder: class {
      uri = "file:///cache/voice.m4a";
      isRecording = false;
      constructor() {
        h.recorders.push(this);
      }
      async prepareToRecordAsync() {}
      record() {
        this.isRecording = true;
      }
      getStatus() {
        return { isRecording: this.isRecording, metering: h.meter };
      }
      async stop() {
        this.isRecording = false;
        h.stopped();
      }
      release() {
        h.released();
      }
    },
  },
  RecordingPresets: { HIGH_QUALITY: { ios: {}, android: {} } },
  setAudioModeAsync: h.mode,
}));
vi.mock("expo-file-system", () => ({
  File: class {
    exists = true;
    size = h.fileSize;
    async bytes() {
      return new Uint8Array(128);
    }
    delete() {
      h.deleted();
    }
  },
}));
vi.mock("expo-speech", () => ({
  getAvailableVoicesAsync: h.voices,
  speak: h.speak,
  stop: h.speechStop,
}));
vi.mock("./api", () => ({ api: h.api }));
import {
  serverSpeechAvailable,
  requestServerSpeechPermission,
  listenServerListing,
  finishServerAnswer,
  stopServerListingSpeech,
} from "./server-listing-speech";
beforeEach(() => {
  vi.clearAllMocks();
  h.recorders = [];
  h.meter = -60;
  h.fileSize = 128;
  h.mode.mockResolvedValue(undefined);
  h.permission.mockResolvedValue({ granted: true });
  h.voices.mockResolvedValue([{ language: "en-GB" }]);
  h.api.mockResolvedValue({ text: "twenty five" });
  h.speechStop.mockResolvedValue(undefined);
  vi.useFakeTimers();
});
afterEach(async () => {
  await stopServerListingSpeech();
  vi.useRealTimers();
});
const prepared = async () => {
  await vi.advanceTimersByTimeAsync(1);
};
it("checks the authenticated backend instead of requiring an installed recognition model", async () => {
  h.api.mockResolvedValue({ enabled: true, languages: ["en"] });
  expect(await serverSpeechAvailable()).toBe("en");
  expect(h.api).toHaveBeenCalledWith("/listing-drafts/voice/capabilities");
  h.api.mockResolvedValue({ enabled: false, languages: [] });
  expect(await serverSpeechAvailable()).toBeNull();
});
it("requires microphone permission", async () => {
  h.permission.mockResolvedValue({ granted: false });
  await expect(requestServerSpeechPermission()).rejects.toThrow("Microphone permission");
});
it("uploads a bounded recording after Done speaking and deletes its temporary file", async () => {
  const processing = vi.fn(),
    result = listenServerListing("en", processing);
  await prepared();
  finishServerAnswer();
  expect(await result).toBe("twenty five");
  expect(processing).toHaveBeenCalledOnce();
  expect(h.api).toHaveBeenCalledWith(
    "/listing-drafts/voice/transcribe?language=en",
    expect.objectContaining({
      method: "POST",
      binary: { bytes: new Uint8Array(128), contentType: "audio/mp4" },
    }),
  );
  expect(h.deleted).toHaveBeenCalledOnce();
  expect(h.released).toHaveBeenCalledOnce();
});
it("stops after a spoken answer followed by silence", async () => {
  h.meter = -20;
  const result = listenServerListing("en");
  await prepared();
  await vi.advanceTimersByTimeAsync(300);
  h.meter = -60;
  await vi.advanceTimersByTimeAsync(1600);
  expect(await result).toBe("twenty five");
  expect(h.stopped).toHaveBeenCalledOnce();
});
it("does not upload when paused during recording", async () => {
  const result = listenServerListing("en");
  const rejected = expect(result).rejects.toThrow("paused");
  await prepared();
  await stopServerListingSpeech();
  await rejected;
  expect(h.api).not.toHaveBeenCalled();
  expect(h.deleted).toHaveBeenCalledOnce();
});
it("aborts an upload on pause and cleans up without using a late response", async () => {
  h.api.mockImplementation(
    (_path, options) =>
      new Promise((_resolve, reject) =>
        options.signal.addEventListener("abort", () => reject(new Error("aborted"))),
      ),
  );
  const result = listenServerListing("en"),
    rejected = expect(result).rejects.toThrow();
  await prepared();
  finishServerAnswer();
  await prepared();
  await stopServerListingSpeech();
  await rejected;
  expect(h.deleted).toHaveBeenCalledOnce();
  expect(h.released).toHaveBeenCalledOnce();
});
it("cleans up a recording rejected by the server", async () => {
  h.api.mockRejectedValue(new Error("No clear answer"));
  const result = listenServerListing("en"),
    rejected = expect(result).rejects.toThrow("No clear answer");
  await prepared();
  finishServerAnswer();
  await rejected;
  expect(h.deleted).toHaveBeenCalledOnce();
});
