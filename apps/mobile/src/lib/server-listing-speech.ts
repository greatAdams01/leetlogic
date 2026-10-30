import { Platform } from "react-native";
import { AudioModule, RecordingPresets, setAudioModeAsync } from "expo-audio";
import { File } from "expo-file-system";
import * as Speech from "expo-speech";
import { api } from "./api";
let cancelActive: (() => void) | undefined;
let finishAnswer: (() => void) | undefined;
let operation = 0;
let cleanupDone: Promise<void> = Promise.resolve();
const paused = () => new Error("Voice listing paused. Your confirmed answers are saved.");
export async function serverSpeechAvailable() {
  if (Platform.OS === "web") return null;
  const capability = await api<{ enabled: boolean; languages: string[] }>(
    "/listing-drafts/voice/capabilities",
  );
  if (!capability.enabled || !capability.languages.includes("en")) return null;
  const voices = await Speech.getAvailableVoicesAsync();
  return voices.some((voice) => /^en[-_]/i.test(voice.language)) ? "en" : null;
}
export async function requestServerSpeechPermission() {
  const result = await AudioModule.requestRecordingPermissionsAsync();
  if (!result.granted)
    throw new Error(
      "Microphone permission is needed to answer by voice. You can also type your listing.",
    );
}
export function speakServerListing(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    Speech.speak(text, {
      language: "en-GB",
      rate: 0.9,
      useApplicationAudioSession: false,
      onDone: () => resolve(),
      onStopped: () => reject(paused()),
      onError: () => reject(new Error("Could not read the question aloud. Please try again.")),
    });
  });
}
export function finishServerAnswer() {
  finishAnswer?.();
}
export async function stopServerListingSpeech() {
  operation++;
  cancelActive?.();
  await Speech.stop();
  await cleanupDone;
}
export async function listenServerListing(
  locale: string,
  onTranscribing?: () => void,
): Promise<string> {
  if (locale !== "en") throw new Error("English voice listing is available for testing.");
  cancelActive?.();
  const id = ++operation;
  await cleanupDone;
  if (id !== operation) throw paused();
  const controller = new AbortController();
  let cancelled = false,
    recording = false,
    uri: string | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let uploadTimer: ReturnType<typeof setTimeout> | undefined;
  let end: (() => void) | undefined;
  const cancel = () => {
    cancelled = true;
    controller.abort();
    end?.();
  };
  const preset = RecordingPresets.HIGH_QUALITY;
  const options = {
    ...preset,
    numberOfChannels: 1,
    bitRate: 64000,
    isMeteringEnabled: true,
    ...(Platform.OS === "ios" ? preset.ios : preset.android),
  };
  const recorder = new AudioModule.AudioRecorder(options);
  let cleaned!: () => void;
  cleanupDone = new Promise<void>((resolve) => {
    cleaned = resolve;
  });
  cancelActive = cancel;
  try {
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    if (cancelled) throw paused();
    await recorder.prepareToRecordAsync({
      ...preset,
      numberOfChannels: 1,
      bitRate: 64000,
      isMeteringEnabled: true,
    });
    if (cancelled) throw paused();
    recorder.record();
    recording = true;
    const started = Date.now();
    let lastSpeech = started,
      speech = false;
    await new Promise<void>((resolve) => {
      end = resolve;
      finishAnswer = resolve;
      timer = setInterval(() => {
        const now = Date.now(),
          status = recorder.getStatus();
        if (typeof status.metering === "number" && status.metering > -45) {
          speech = true;
          lastSpeech = now;
        }
        if (
          cancelled ||
          !status.isRecording ||
          now - started >= 29500 ||
          (speech && now - lastSpeech >= 1500) ||
          (!speech && now - started >= 8000)
        )
          resolve();
      }, 100);
    });
    clearInterval(timer);
    await recorder.stop();
    recording = false;
    uri = recorder.uri;
    if (cancelled) throw paused();
    await setAudioModeAsync({ allowsRecording: false });
    if (!uri) throw new Error("Could not record your answer. Please try again.");
    const file = new File(uri);
    if (!file.exists || file.size < 16 || file.size > 2 * 1024 * 1024)
      throw new Error("Please record a shorter answer and try again.");
    onTranscribing?.();
    const bytes = await file.bytes();
    if (cancelled) throw paused();
    uploadTimer = setTimeout(() => controller.abort(), 45000);
    const response = await api<{ text: string }>("/listing-drafts/voice/transcribe?language=en", {
      method: "POST",
      binary: { bytes, contentType: "audio/mp4" },
      signal: controller.signal,
    });
    if (cancelled) throw paused();
    return response.text;
  } finally {
    clearInterval(timer);
    clearTimeout(uploadTimer);
    if (recording) await recorder.stop().catch(() => {});
    uri = uri || recorder.uri;
    try {
      recorder.release();
    } catch {}
    if (uri) {
      try {
        const file = new File(uri);
        if (file.exists) file.delete();
      } catch {}
    }
    if (cancelActive === cancel) cancelActive = undefined;
    if (finishAnswer === end) finishAnswer = undefined;
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    cleaned();
  }
}
