import { writeFileSync } from "node:fs";
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
  typeInstead: vi.fn(),
  playback: {
    playing: false,
    didJustFinish: false,
    currentTime: 0,
    isLoaded: true,
    isBuffering: false,
  },
  mode: { isRecording: false, durationMillis: 1000 },
}));
vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (styles: any) => styles },
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
  useAudioPlayerStatus: () => h.playback,
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
  return {
    colors: {
      paper: "#faf7f0",
      green: "#14532d",
      action: "#2e9e4f",
      ink: "#1c1c1c",
      line: "#e2ddd5",
    },
    ...Object.fromEntries(
      ["Card", "Label", "Notice", "Icon"].map((name) => [
        name,
        ({ children, ...props }: any) => createElement(name, props, children),
      ]),
    ),
  };
});
import { ListingVoiceNote } from "../components/listing-voice-note";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let renderer: ReactTestRenderer;
const button = (title: string) =>
  renderer.root
    .findAllByType("Pressable" as never)
    .find((n) => n.props.accessibilityLabel === title)!;
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
  Object.assign(h.playback, {
    playing: false,
    didJustFinish: false,
    currentTime: 0,
    isLoaded: true,
    isBuffering: false,
  });
});
afterEach(async () => {
  if (renderer) await testRenderer.act(async () => renderer.unmount());
});
const mount = async () => {
  await testRenderer.act(async () => {
    renderer = testRenderer.create(
      <ListingVoiceNote
        draftId="draft"
        onActivityChange={h.activity}
        onTypeInstead={h.typeInstead}
      />,
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

it("focuses typing without changing a saved recording", async () => {
  await mount();
  await testRenderer.act(async () => button("Type instead").props.onPress());
  expect(h.typeInstead).toHaveBeenCalledTimes(1);
  expect(h.permission).not.toHaveBeenCalled();
  expect(h.remove).not.toHaveBeenCalled();
});
it("uses the large mic control as an explicit start/stop toggle", async () => {
  await mount();
  await testRenderer.act(async () => button("Record voice note").props.onPress());
  expect(button("Stop recording")).toBeDefined();
  await testRenderer.act(async () => button("Stop recording").props.onPress());
  expect(h.recorder.stop).toHaveBeenCalledTimes(1);
  expect(h.set).toHaveBeenCalledTimes(1);
  expect(button("Play voice note")).toBeDefined();
});
it("does not lose the previous note if a replacement fails", async () => {
  h.get.mockResolvedValue(
    JSON.stringify({
      uri: "file:///documents/listing-voice/farmer/saved.m4a",
      durationMillis: 8000,
      locale: "ig",
    }),
  );
  await mount();
  await testRenderer.act(async () => button("Record again").props.onPress());
  await testRenderer.act(async () => h.listener({ isFinished: true, hasError: true, url: null }));
  expect(button("Play voice note")).toBeDefined();
  expect(h.remove).not.toHaveBeenCalled();
  expect(h.set).not.toHaveBeenCalled();
});
it("replays a completed note from the beginning and supports pause", async () => {
  h.get.mockResolvedValue(
    JSON.stringify({
      uri: "file:///documents/listing-voice/farmer/saved.m4a",
      durationMillis: 8000,
      locale: "ig",
    }),
  );
  h.playback.didJustFinish = true;
  await mount();
  await testRenderer.act(async () => button("Play voice note").props.onPress());
  expect(h.player.seekTo).toHaveBeenCalledWith(0);
  h.playback.playing = true;
  await testRenderer.act(async () =>
    renderer.update(<ListingVoiceNote draftId="draft" onActivityChange={h.activity} />),
  );
  await testRenderer.act(async () => button("Pause voice note").props.onPress());
  expect(h.player.pause).toHaveBeenCalled();
});
it("seeks to the tapped position using the real note duration", async () => {
  h.get.mockResolvedValue(
    JSON.stringify({
      uri: "file:///documents/listing-voice/farmer/saved.m4a",
      durationMillis: 8000,
      locale: "ig",
    }),
  );
  await mount();
  const track = () =>
    renderer.root
      .findAllByType("Pressable" as never)
      .find((node) => node.props.testID === "voice-note-progress")!;
  await testRenderer.act(async () =>
    track().props.onLayout({ nativeEvent: { layout: { width: 200 } } }),
  );
  await testRenderer.act(async () => track().props.onPress({ nativeEvent: { locationX: 100 } }));
  expect(h.player.seekTo).toHaveBeenCalledWith(4);
});
it("does not show sample audio before a real note is saved", async () => {
  await mount();
  expect(button("Play voice note")).toBeUndefined();
  expect(button("Remove voice note")).toBeUndefined();
});

it("renders the real saved duration, playback position, and native-size Figma assets", async () => {
  h.get.mockResolvedValue(
    JSON.stringify({
      uri: "file:///documents/listing-voice/farmer/saved.m4a",
      durationMillis: 8000,
      locale: "ig",
      levels: [
        0.2, 0.4, 0.6, 0.3, 0.7, 0.5, 0.8, 0.4, 0.6, 0.2, 0.5, 0.7, 0.3, 0.6, 0.4, 0.5, 0.2, 0.3,
      ],
    }),
  );
  h.playback.currentTime = 2;
  await mount();
  const track = renderer.root
    .findAllByType("Pressable" as never)
    .find((node) => node.props.testID === "voice-note-progress")!;
  expect(track.props.accessibilityValue).toMatchObject({ max: 8, now: 2, text: "0:02 / 0:08" });
  const icons = renderer.root.findAllByType("Icon" as never);
  expect(icons.find((node) => node.props.name === "listingVoiceMic")!.props.nativeSize).toEqual({
    width: 40.9524,
    height: 40.9524,
  });
  expect(icons.find((node) => node.props.name === "listingVoicePlay")!.props.nativeSize).toEqual({
    width: 16.381,
    height: 16.381,
  });
  expect(icons.find((node) => node.props.name === "listingVoiceSaved")!.props.nativeSize).toEqual({
    width: 9.65972,
    height: 7.32639,
  });
  if (process.env.VOICE_NOTE_PREVIEW) {
    const clean = (node: any): any =>
      typeof node === "string"
        ? node
        : !node
          ? null
          : {
              type: node.type,
              props: {
                style: node.props.style,
                name: node.props.name,
                nativeSize: node.props.nativeSize,
                muted: node.props.muted,
              },
              children: node.children?.map(clean),
            };
    writeFileSync(process.env.VOICE_NOTE_PREVIEW, JSON.stringify(clean(renderer.toJSON())));
  }
});

it("keeps playable audio when optional waveform metadata is missing or invalid", async () => {
  h.get.mockResolvedValue(
    JSON.stringify({
      uri: "file:///documents/listing-voice/farmer/saved.m4a",
      durationMillis: 8000,
      locale: "ig",
      levels: ["invalid"],
    }),
  );
  await mount();
  expect(button("Play voice note")).toBeDefined();
  await testRenderer.act(async () => button("Play voice note").props.onPress());
  expect(h.player.play).toHaveBeenCalled();
});
