import React from "react";
import * as testRenderer from "react-test-renderer";
import type { ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  permission: vi.fn(),
  copy: vi.fn(),
  deleted: vi.fn(),
  activity: vi.fn(),
  listener: null as any,
  appListener: null as any,
  recorder: {
    isRecording: false,
    currentTime: 1,
    uri: "file:///cache/note.m4a",
    prepareToRecordAsync: vi.fn(),
    record: vi.fn(),
    stop: vi.fn(),
  },
  player: { currentTime: 0, play: vi.fn(), pause: vi.fn(), seekTo: vi.fn() },
  audioMode: vi.fn(),
  mode: { isRecording: false, durationMillis: 1000 },
}));
vi.mock("react-native", () => ({
  View: "View",
  AppState: {
    addEventListener: (_name: string, fn: unknown) => {
      h.appListener = fn;
      return { remove: vi.fn() };
    },
  },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: h.get, setItem: h.set, removeItem: h.remove },
}));
vi.mock("expo-audio", () => ({
  AudioModule: { requestRecordingPermissionsAsync: h.permission },
  RecordingPresets: { HIGH_QUALITY: {} },
  setAudioModeAsync: h.audioMode,
  useAudioRecorder: (_opts: unknown, listener: unknown) => {
    h.listener = listener;
    return h.recorder;
  },
  useAudioRecorderState: () => h.mode,
  useAudioPlayer: () => h.player,
  useAudioPlayerStatus: () => ({ playing: false, didJustFinish: false }),
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => "new-note" }));
vi.mock("expo-file-system", () => ({
  Paths: { document: "file:///documents" },
  Directory: class {
    uri: string;
    constructor(...parts: any[]) {
      this.uri = parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/");
    }
    create = vi.fn();
  },
  File: class {
    uri: string;
    size = 5000;
    exists = true;
    constructor(...parts: any[]) {
      this.uri = parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/");
    }
    copy = h.copy;
    delete = h.deleted;
  },
}));
vi.mock("../state", () => ({
  useApp: () => ({
    user: { id: "farmer" },
    locale: "ig",
    ui: (s: string, p: Record<string, string | number> = {}) =>
      s.replace(/\{(\w+)\}/g, (_, k) => String(p[k])),
  }),
}));
vi.mock("../components/ui", async () => {
  const { createElement } = await import("react");
  return Object.fromEntries(
    ["Card", "Label", "Notice", "Button"].map((name) => [
      name,
      ({ children, ...props }: any) => createElement(name, props, children),
    ]),
  );
});
import { ListingVoiceNote } from "../components/listing-voice-note";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let renderer: ReactTestRenderer;
const button = (title: string) =>
  renderer.root.findAllByType("Button" as never).find((n) => n.props.title === title)!;
beforeEach(() => {
  vi.clearAllMocks();
  h.get.mockResolvedValue(null);
  h.set.mockResolvedValue(undefined);
  h.remove.mockResolvedValue(undefined);
  h.permission.mockResolvedValue({ granted: true });
  h.audioMode.mockResolvedValue(undefined);
  h.recorder.prepareToRecordAsync.mockResolvedValue(undefined);
  h.recorder.stop.mockResolvedValue(undefined);
  h.recorder.isRecording = false;
  h.recorder.currentTime = 1;
  h.mode.isRecording = false;
});
afterEach(async () => {
  if (renderer) await testRenderer.act(async () => renderer.unmount());
});
const mount = async () => {
  await testRenderer.act(async () => {
    renderer = testRenderer.create(
      <ListingVoiceNote draftId="draft" onActivityChange={h.activity} />,
    );
  });
};
describe("device-only listing voice note", () => {
  it("requests microphone access only after a tap and keeps typing available after denial", async () => {
    h.permission.mockResolvedValue({ granted: false });
    await mount();
    expect(h.permission).not.toHaveBeenCalled();
    await testRenderer.act(async () => button("Record voice note").props.onPress());
    expect(h.recorder.record).not.toHaveBeenCalled();
    expect(JSON.stringify(renderer.toJSON())).toContain("You can still type your details");
    expect(h.activity).toHaveBeenLastCalledWith(false);
    expect(h.set).not.toHaveBeenCalled();
  });
  it("records for at most 30 seconds and saves only owner-scoped local metadata", async () => {
    await mount();
    await testRenderer.act(async () => button("Record voice note").props.onPress());
    expect(h.recorder.record).toHaveBeenCalledWith({ forDuration: 30 });
    expect(h.activity).toHaveBeenCalledWith(true);
    await testRenderer.act(async () =>
      h.listener({ isFinished: true, hasError: false, url: "file:///cache/note.m4a" }),
    );
    expect(h.copy).toHaveBeenCalled();
    expect(h.set).toHaveBeenCalledWith("listing-voice:farmer:draft", expect.any(String));
    expect(JSON.parse(h.set.mock.calls[0]![1])).toMatchObject({
      uri: "file:///documents/listing-voice/farmer/new-note.m4a",
      locale: "ig",
    });
    expect(button("Play voice note")).toBeDefined();
    expect(h.activity).toHaveBeenLastCalledWith(false);
  });
  it("plays and removes a saved note without any server request", async () => {
    h.get.mockResolvedValue(
      JSON.stringify({
        uri: "file:///documents/listing-voice/farmer/saved.m4a",
        durationMillis: 2000,
        locale: "ig",
      }),
    );
    await mount();
    await testRenderer.act(async () => button("Play voice note").props.onPress());
    expect(h.player.play).toHaveBeenCalled();
    await testRenderer.act(async () => button("Remove voice note").props.onPress());
    expect(h.remove).toHaveBeenCalledWith("listing-voice:farmer:draft");
    expect(h.deleted).toHaveBeenCalled();
    expect(button("Record voice note")).toBeDefined();
  });
  it("does not open another account's recording", async () => {
    h.get.mockResolvedValue(
      JSON.stringify({
        uri: "file:///documents/listing-voice/another-farmer/saved.m4a",
        durationMillis: 2000,
        locale: "ig",
      }),
    );
    await mount();
    expect(button("Play voice note")).toBeUndefined();
    expect(h.player.play).not.toHaveBeenCalled();
  });
  it("leaves no saved note after an interrupted recording and releases the busy state", async () => {
    await mount();
    await testRenderer.act(async () => button("Record voice note").props.onPress());
    await testRenderer.act(async () => h.listener({ hasError: true, isFinished: true, url: null }));
    expect(h.set).not.toHaveBeenCalled();
    expect(h.activity).toHaveBeenLastCalledWith(false);
    expect(JSON.stringify(renderer.toJSON())).toContain("couldn’t save");
  });
  it("never reads a native recorder after Expo releases it during unmount", async () => {
    await mount();
    Object.defineProperty(h.recorder, "isRecording", {
      configurable: true,
      get: () => {
        throw new Error("Cannot use shared object that was already released");
      },
    });
    try {
      await testRenderer.act(async () => renderer.unmount());
      expect(h.recorder.stop).not.toHaveBeenCalled();
      // A delayed native completion event must also ignore the released object.
      Object.defineProperty(h.recorder, "currentTime", {
        configurable: true,
        get: () => {
          throw new Error("released");
        },
      });
      await testRenderer.act(async () =>
        h.listener({ isFinished: true, hasError: false, url: "file:///cache/note.m4a" }),
      );
    } finally {
      Object.defineProperty(h.recorder, "isRecording", {
        configurable: true,
        writable: true,
        value: false,
      });
      Object.defineProperty(h.recorder, "currentTime", {
        configurable: true,
        writable: true,
        value: 1,
      });
    }
  });
  it("stops recording when the app leaves the foreground", async () => {
    await mount();
    await testRenderer.act(async () => button("Record voice note").props.onPress());
    await testRenderer.act(async () => h.appListener("background"));
    expect(h.recorder.stop).toHaveBeenCalled();
    expect(h.activity).toHaveBeenLastCalledWith(false);
  });
});
