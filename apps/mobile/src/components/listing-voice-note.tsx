import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppState, View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { Directory, File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { useApp } from "../state";
import { Card, Label, Notice, Icon, colors } from "./ui";
type Note = { uri: string; durationMillis: number; locale: string; levels?: number[] };
const clock = (millis: number) =>
  `${Math.floor(millis / 60000)}:${String(Math.floor((millis % 60000) / 1000)).padStart(2, "0")}`;
const waveform = (samples: number[]) =>
  Array.from({ length: 18 }, (_, index) => {
    const slice = samples.slice(
      Math.floor((index * samples.length) / 18),
      Math.max(
        Math.floor(((index + 1) * samples.length) / 18),
        Math.floor((index * samples.length) / 18) + 1,
      ),
    );
    return Math.max(0.12, ...slice);
  });
/** Deliberately device-only: this component has no API or transcription dependency. */
export function ListingVoiceNote({
  draftId,
  disabled = false,
  onActivityChange,
  onTypeInstead,
}: {
  draftId: string;
  disabled?: boolean;
  onActivityChange: (active: boolean) => void;
  onTypeInstead?: () => void;
}) {
  const a = useApp();
  const key = `listing-voice:${a.user!.id}:${draftId}`;
  const folder = new Directory(Paths.document, "listing-voice", a.user!.id);
  const [note, setNote] = useState<Note | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [recordingActive, setRecordingActive] = useState(false),
    [playBusy, setPlayBusy] = useState(false),
    [levels, setLevels] = useState<number[]>([]),
    [trackWidth, setTrackWidth] = useState(0),
    [busyLabel, setBusyLabel] = useState("Preparing microphone…");
  const samples = useRef<number[]>([]);
  const playPending = useRef(false);
  const identity = useRef(key);
  identity.current = key;
  const mounted = useRef(true),
    active = useRef(false),
    operation = useRef(false),
    duration = useRef(0);
  const activity = useRef(onActivityChange);
  activity.current = onActivityChange;
  const player = useAudioPlayer(note?.uri || null);
  const playback = useAudioPlayerStatus(player);
  const finishRef = useRef<(uri: string | null, failed?: boolean) => Promise<void>>(async () => {});
  const recorder = useAudioRecorder(
    { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true },
    (status) => {
      if (status.isFinished || status.hasError) void finishRef.current(status.url, status.hasError);
    },
  );
  const recording = useAudioRecorderState(recorder, 200);
  if (recording.isRecording) duration.current = recording.durationMillis;
  useEffect(() => {
    if (!recording.isRecording || !Number.isFinite(recording.metering)) return;
    const value = Math.min(1, Math.max(0.12, (recording.metering! + 60) / 60));
    samples.current = [...samples.current.slice(-149), value];
    setLevels(samples.current.slice(-18));
  }, [recording.durationMillis, recording.isRecording, recording.metering]);
  const current = () => mounted.current && identity.current === key;
  const ownFile = (uri: string) => uri.startsWith(`${folder.uri.replace(/\/$/, "")}/`);
  const deleteFile = (uri: string) => {
    if (ownFile(uri)) {
      const file = new File(uri);
      if (file.exists) file.delete();
    }
  };
  const finish = async (uri: string | null, failed = false) => {
    if (!current() || !active.current) return;
    active.current = false;
    setRecordingActive(false);
    setBusyLabel("Saving voice note…");
    operation.current = true;
    let saved: File | null = null;
    duration.current = Math.max(duration.current, recorder.currentTime * 1000);
    try {
      if (failed || !uri || duration.current < 300) throw new Error("recording");
      folder.create({ intermediates: true, idempotent: true });
      saved = new File(folder, `${randomUUID()}.m4a`);
      const source = new File(uri);
      if (!source.exists || !source.size || source.size > 5 * 1024 * 1024)
        throw new Error("recording");
      source.copy(saved);
      const next = {
        uri: saved.uri,
        durationMillis: Math.min(30000, duration.current),
        locale: a.locale,
        ...(samples.current.length ? { levels: waveform(samples.current) } : {}),
      };
      await AsyncStorage.setItem(key, JSON.stringify(next));
      if (current()) setNote(next);
      if (note) {
        try {
          deleteFile(note.uri);
        } catch {
          /* Old local file cleanup must not invalidate the saved note. */
        }
      }
      // Native recorder cache files are no longer needed after the private copy.
      try {
        if (source.exists && uri !== saved.uri) source.delete();
      } catch {
        /* OS cache cleanup can retry later. */
      }
    } catch {
      if (saved?.exists) saved.delete();
      if (mounted.current) setError(a.ui("We couldn’t save your recording. Please try again."));
    } finally {
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      operation.current = false;
      activity.current(false);
      if (mounted.current) setBusy(false);
    }
  };
  finishRef.current = finish;
  // Layout cleanup runs before Expo's passive shared-object release. Never
  // touch recorder/player native properties from our unmount cleanup.
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current = false;
    };
  }, [key, recorder]);
  useEffect(() => {
    mounted.current = true;
    setReady(false);
    setNote(null);
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const saved = JSON.parse(raw) as Note;
          if (
            typeof saved.uri === "string" &&
            ownFile(saved.uri) &&
            Number.isFinite(saved.durationMillis) &&
            saved.durationMillis >= 300 &&
            saved.durationMillis <= 30000 &&
            new File(saved.uri).exists
          ) {
            const safeLevels =
              Array.isArray(saved.levels) &&
              saved.levels.length === 18 &&
              saved.levels.every((level) => Number.isFinite(level) && level >= 0 && level <= 1)
                ? saved.levels
                : undefined;
            if (!cancelled) setNote({ ...saved, levels: safeLevels });
          } else if (!cancelled)
            setError(a.ui("This recording is no longer on your device. Please record it again."));
        }
      } catch {
        if (!cancelled) setError(a.ui("We couldn’t open your saved recording. Please try again."));
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      mounted.current = false;
      active.current = false;
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      activity.current(false);
    };
  }, [key, recorder]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (mounted.current && state !== "active") {
        if (active.current) void stop();
        else player.pause();
      }
    });
    return () => sub.remove();
  }, [recorder]);
  const start = async () => {
    if (disabled || operation.current || active.current || playPending.current || !ready) return;
    operation.current = true;
    setBusy(true);
    setBusyLabel("Preparing microphone…");
    setError("");
    activity.current(true);
    try {
      player.pause();
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!current()) return;
      if (!permission.granted) {
        setError(
          a.ui(
            "Allow microphone access in Settings to record a voice note. You can still type your details.",
          ),
        );
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        allowsBackgroundRecording: false,
      });
      if (!current()) return;
      await recorder.prepareToRecordAsync();
      if (!current()) return;
      duration.current = 0;
      samples.current = [];
      setLevels([]);
      active.current = true;
      recorder.record({ forDuration: 30 });
      if (active.current) setRecordingActive(true);
    } catch {
      active.current = false;
      if (current()) {
        setRecordingActive(false);
        setError(a.ui("We couldn’t start recording. Please try again."));
      }
    } finally {
      operation.current = false;
      if (!active.current) {
        if (mounted.current) setBusy(false);
        activity.current(false);
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
    }
  };
  const stop = async () => {
    if (!active.current || operation.current) return;
    operation.current = true;
    duration.current = Math.max(duration.current, recorder.currentTime * 1000);
    try {
      await recorder.stop();
      await finishRef.current(recorder.uri);
    } catch {
      await finishRef.current(null, true);
    }
  };
  const play = async () => {
    if (!note || disabled || busy || playPending.current || playback.isLoaded === false) return;
    playPending.current = true;
    setPlayBusy(true);
    setError("");
    try {
      if (!new File(note.uri).exists) throw new Error("missing");
      if (playback.playing) player.pause();
      else {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        if (!current()) return;
        if (playback.didJustFinish || player.currentTime >= note.durationMillis / 1000)
          await player.seekTo(0);
        if (current()) player.play();
      }
    } catch {
      if (current()) setError(a.ui("We couldn’t play this recording. Please record it again."));
    } finally {
      playPending.current = false;
      if (current()) setPlayBusy(false);
    }
  };
  const seek = async (seconds: number) => {
    if (!note || disabled || busy || playPending.current || playback.isLoaded === false) return;
    playPending.current = true;
    try {
      await player.seekTo(Math.max(0, Math.min(note.durationMillis / 1000, seconds)));
    } catch {
      if (current()) setError(a.ui("We couldn’t play this recording. Please record it again."));
    } finally {
      playPending.current = false;
    }
  };
  const remove = async () => {
    if (!note || busy || disabled || operation.current || playPending.current) return;
    operation.current = true;
    setBusy(true);
    setBusyLabel("Removing voice note…");
    activity.current(true);
    setError("");
    try {
      player.pause();
      await AsyncStorage.removeItem(key);
      deleteFile(note.uri);
      setNote(null);
    } catch {
      setError(a.ui("We couldn’t remove your recording. Please try again."));
    } finally {
      operation.current = false;
      setBusy(false);
      activity.current(false);
    }
  };
  const elapsed = Math.min(30000, Math.max(0, duration.current));
  const position = note
    ? Math.min(note.durationMillis, Math.max(0, (playback.currentTime || 0) * 1000))
    : 0;
  const progress = note ? position / note.durationMillis : 0;
  const controlsDisabled = disabled || busy || !ready || playBusy;
  return (
    <Card style={styles.card}>
      <Label style={styles.eyebrow}>QUALITY & LOGISTICS VOICE MEMO</Label>
      <Label style={styles.heading}>Say what is in the basket</Label>
      <Label muted style={styles.description}>
        Describe freshness, harvest date, or special packaging in your own words or local language.
      </Label>
      <View style={styles.recorderArea}>
        <View style={[styles.micHalo, recordingActive && styles.activeHalo]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a.ui(
              recordingActive ? "Stop recording" : note ? "Record again" : "Record voice note",
            )}
            accessibilityHint={a.ui("Tap to start or stop. Recording ends after 30 seconds.")}
            accessibilityState={{
              disabled: !recordingActive && controlsDisabled,
              busy: busy && !recordingActive,
            }}
            disabled={!recordingActive && controlsDisabled}
            onPress={() => void (recordingActive ? stop() : start())}
            style={[
              styles.microphone,
              recordingActive && { backgroundColor: "#9b3525" },
              !recordingActive && controlsDisabled && { opacity: 0.45 },
            ]}
          >
            {recordingActive ? (
              <View style={styles.stopSymbol} />
            ) : busy || !ready ? (
              <ActivityIndicator color="white" />
            ) : (
              <Icon name="listingVoiceMic" nativeSize={{ width: 40.9524, height: 40.9524 }} />
            )}
          </Pressable>
        </View>
        <Label style={styles.recordCaption}>
          {recordingActive
            ? "Tap to stop"
            : busy
              ? busyLabel
              : !ready
                ? "Loading voice note…"
                : note
                  ? "Record again"
                  : "Tap to record"}
        </Label>
        <Label muted style={styles.hint}>
          {recordingActive
            ? a.ui("{elapsed} / 0:30", { elapsed: clock(elapsed) })
            : "Any language · up to 30 seconds"}
        </Label>
        {recordingActive && (
          <View accessible={false} style={styles.liveLevels}>
            {Array.from({ length: 18 }, (_, index) => (
              <View
                key={index}
                style={{
                  width: 3,
                  height: 6 + (levels[index] || 0) * 28,
                  backgroundColor: colors.green,
                  borderRadius: 2,
                }}
              />
            ))}
          </View>
        )}
      </View>
      {!!error && <Notice text={error} error />}
      {note && !recordingActive && (
        <View style={styles.playbackCard}>
          <View style={styles.playbackRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={a.ui(playback.playing ? "Pause voice note" : "Play voice note")}
              accessibilityState={{
                disabled: controlsDisabled || playback.isLoaded === false,
                busy: playBusy || playback.isBuffering || playback.isLoaded === false,
              }}
              disabled={controlsDisabled || playback.isLoaded === false}
              onPress={() => void play()}
              style={[styles.playButton, controlsDisabled && { opacity: 0.45 }]}
            >
              <View style={styles.playDisk}>
                {playBusy || playback.isBuffering || playback.isLoaded === false ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Icon
                    name={playback.playing ? "listingVoicePause" : "listingVoicePlay"}
                    nativeSize={{ width: 16.381, height: 16.381 }}
                  />
                )}
              </View>
            </Pressable>
            <Pressable
              testID="voice-note-progress"
              accessibilityRole="adjustable"
              accessibilityLabel={a.ui("Voice note playback position")}
              accessibilityHint={a.ui("Tap to seek, or adjust by five seconds")}
              accessibilityValue={{
                min: 0,
                max: Math.ceil(note.durationMillis / 1000),
                now: Math.floor(position / 1000),
                text: `${clock(position)} / ${clock(note.durationMillis)}`,
              }}
              accessibilityActions={[
                { name: "increment", label: a.ui("Forward five seconds") },
                { name: "decrement", label: a.ui("Back five seconds") },
              ]}
              onAccessibilityAction={(event) =>
                void seek(position / 1000 + (event.nativeEvent.actionName === "increment" ? 5 : -5))
              }
              disabled={controlsDisabled || playback.isLoaded === false}
              onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
              onPress={(event) => {
                if (trackWidth)
                  void seek(
                    ((event.nativeEvent.locationX / trackWidth) * note.durationMillis) / 1000,
                  );
              }}
              style={styles.waveform}
            >
              {Array.from({ length: 18 }, (_, index) => (
                <View
                  key={index}
                  style={{
                    width: 3,
                    height: note.levels ? 6 + note.levels[index]! * 30 : 8,
                    borderRadius: 2,
                    backgroundColor: progress > index / 18 ? colors.green : "#d5e5dc",
                  }}
                />
              ))}
            </Pressable>
            <Label style={styles.time}>{clock(note.durationMillis)}</Label>
          </View>
          <View style={styles.playbackDetails}>
            <View
              style={{
                width: 14.333,
                height: 14.333,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="listingVoiceSaved" nativeSize={{ width: 9.65972, height: 7.32639 }} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Label muted style={styles.savedCaption}>
                Saved on this phone.
              </Label>
              <Label muted style={styles.hint}>
                {a.ui("{elapsed} / {duration}", {
                  elapsed: clock(position),
                  duration: clock(note.durationMillis),
                })}
              </Label>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={a.ui("Remove voice note")}
              disabled={controlsDisabled}
              onPress={() => void remove()}
              style={styles.toolAction}
            >
              <Icon name="listingTrash" nativeSize={{ width: 24, height: 24 }} />
            </Pressable>
          </View>
        </View>
      )}
      <Label muted style={styles.hint}>
        Listen and type the details below. This note is not transcribed or sent to buyers.
      </Label>
      {!!onTypeInstead && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={a.ui("Type instead")}
          disabled={disabled || busy || playBusy}
          onPress={() => {
            player.pause();
            onTypeInstead();
          }}
          style={styles.typeAction}
        >
          <Label style={styles.typeText}>Type instead</Label>
        </Pressable>
      )}
    </Card>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    padding: 8,
    gap: 12,
    borderRadius: 16,
  },
  eyebrow: {
    fontFamily: "NotoBold",
    fontSize: 12.286,
    lineHeight: 16.381,
    letterSpacing: 1.2286,
    color: colors.green,
  },
  heading: {
    fontFamily: "Montserrat",
    fontSize: 28.667,
    lineHeight: 34.81,
    letterSpacing: -0.7167,
    color: colors.ink,
  },
  description: { fontSize: 16.381, lineHeight: 26.619 },
  recorderArea: { alignItems: "center", paddingVertical: 24, gap: 8 },
  micHalo: {
    padding: 8.19,
    borderRadius: 999,
    backgroundColor: "rgba(31,111,80,0.08)",
    marginBottom: 8,
  },
  activeHalo: { backgroundColor: "#fce6de" },
  microphone: {
    width: 94.19,
    height: 94.19,
    borderRadius: 48,
    backgroundColor: colors.action,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1f6f50",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 4,
  },
  stopSymbol: { width: 28, height: 28, borderRadius: 6, backgroundColor: "white" },
  recordCaption: {
    fontFamily: "NotoBold",
    fontSize: 16.381,
    lineHeight: 24.571,
    color: colors.ink,
  },
  hint: { fontSize: 12.286, lineHeight: 16.381 },
  liveLevels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: 180,
    height: 36,
    marginTop: 4,
  },
  playbackCard: {
    backgroundColor: "white",
    padding: 17.405,
    gap: 12.286,
    borderRadius: 16.381,
    borderWidth: 1.024,
    borderColor: "#e9e5dd",
  },
  playbackRow: { flexDirection: "row", alignItems: "center", gap: 14.333 },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  playDisk: {
    width: 40.952,
    height: 40.952,
    borderRadius: 21,
    backgroundColor: colors.action,
    alignItems: "center",
    justifyContent: "center",
  },
  waveform: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 44,
    minWidth: 54,
    overflow: "hidden",
  },
  time: { fontFamily: "NotoBold", fontSize: 14.333, lineHeight: 20.476, color: colors.ink },
  playbackDetails: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 11.262,
    gap: 6.143,
  },
  savedCaption: { fontSize: 12.286, lineHeight: 16.381 },
  toolAction: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#9b3525",
  },
  typeAction: {
    alignSelf: "center",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  typeText: {
    fontFamily: "NotoBold",
    fontSize: 16.381,
    lineHeight: 24.571,
    textDecorationLine: "underline",
    color: colors.ink,
  },
});
