import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
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
import { Button, Card, Label, Notice } from "./ui";
type Note = { uri: string; durationMillis: number; locale: string };
/** Deliberately device-only: this component has no API or transcription dependency. */
export function ListingVoiceNote({
  draftId,
  disabled = false,
  onActivityChange,
}: {
  draftId: string;
  disabled?: boolean;
  onActivityChange: (active: boolean) => void;
}) {
  const a = useApp();
  const key = `listing-voice:${a.user!.id}:${draftId}`;
  const folder = new Directory(Paths.document, "listing-voice", a.user!.id);
  const [note, setNote] = useState<Note | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  const mounted = useRef(true),
    active = useRef(false),
    operation = useRef(false),
    duration = useRef(0);
  const activity = useRef(onActivityChange);
  activity.current = onActivityChange;
  const player = useAudioPlayer(note?.uri || null);
  const playback = useAudioPlayerStatus(player);
  const finishRef = useRef<(uri: string | null, failed?: boolean) => Promise<void>>(async () => {});
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (status) => {
    if (status.isFinished || status.hasError) void finishRef.current(status.url, status.hasError);
  });
  const recording = useAudioRecorderState(recorder, 200);
  if (recording.isRecording) duration.current = recording.durationMillis;
  const ownFile = (uri: string) => uri.startsWith(`${folder.uri.replace(/\/$/, "")}/`);
  const deleteFile = (uri: string) => {
    if (ownFile(uri)) {
      const file = new File(uri);
      if (file.exists) file.delete();
    }
  };
  const finish = async (uri: string | null, failed = false) => {
    if (!mounted.current || !active.current) return;
    active.current = false;
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
      };
      await AsyncStorage.setItem(key, JSON.stringify(next));
      if (mounted.current) setNote(next);
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
            new File(saved.uri).exists
          ) {
            if (!cancelled) setNote(saved);
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
      if (mounted.current && state !== "active" && active.current) void stop();
    });
    return () => sub.remove();
  }, [recorder]);
  const start = async () => {
    if (disabled || operation.current || active.current || !ready) return;
    operation.current = true;
    setBusy(true);
    setError("");
    activity.current(true);
    try {
      player.pause();
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!mounted.current) return;
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
      if (!mounted.current) return;
      await recorder.prepareToRecordAsync();
      if (!mounted.current) return;
      duration.current = 0;
      active.current = true;
      recorder.record({ forDuration: 30 });
    } catch {
      active.current = false;
      if (mounted.current) setError(a.ui("We couldn’t start recording. Please try again."));
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
    if (!note || disabled || busy) return;
    setError("");
    try {
      if (!new File(note.uri).exists) throw new Error("missing");
      if (playback.playing) player.pause();
      else {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        if (!mounted.current) return;
        if (playback.didJustFinish || player.currentTime >= note.durationMillis / 1000)
          await player.seekTo(0);
        if (mounted.current) player.play();
      }
    } catch {
      if (mounted.current)
        setError(a.ui("We couldn’t play this recording. Please record it again."));
    }
  };
  const remove = async () => {
    if (!note || busy || disabled || operation.current) return;
    operation.current = true;
    setBusy(true);
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
  return (
    <Card>
      <Label style={{ fontFamily: "NotoBold" }}>Speak your listing details</Label>
      <Label muted>
        Describe your produce, quantity, price and pickup location in your own language.
      </Label>
      <Label muted>
        Use playback to help fill in the fields below. Automatic speech-to-text is not available
        yet. Your recording stays on this device.
      </Label>
      {error && <Notice text={error} error />}
      {busy && active.current ? (
        <>
          <Label>
            {a.ui("Recording · {seconds} / 30 seconds", {
              seconds: Math.min(30, Math.floor(recording.durationMillis / 1000)),
            })}
          </Label>
          <Button title="Stop recording" onPress={() => void stop()} />
        </>
      ) : (
        <View style={{ gap: 10 }}>
          {note && (
            <>
              <Label>
                {a.ui("Voice note · {seconds} seconds", {
                  seconds: Math.ceil(note.durationMillis / 1000),
                })}
              </Label>
              <Button
                secondary
                title={playback.playing ? "Pause voice note" : "Play voice note"}
                disabled={disabled || busy}
                onPress={() => void play()}
              />
            </>
          )}
          <Button
            title={note ? "Record again" : "Record voice note"}
            loading={busy}
            disabled={disabled || busy || !ready}
            onPress={() => void start()}
          />
          {note && (
            <Button
              secondary
              title="Remove voice note"
              disabled={disabled || busy}
              onPress={() => void remove()}
            />
          )}
        </View>
      )}
    </Card>
  );
}
