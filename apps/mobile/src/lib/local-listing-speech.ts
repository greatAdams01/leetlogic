import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
type Recognition = typeof import("expo-speech-recognition").ExpoSpeechRecognitionModule;
type Speaker = {
  englishRecognitionLocales?(): Promise<string[]>;
  available(): Promise<boolean>;
  speak(text: string): Promise<void>;
  stop(): Promise<void>;
};
const recognition = requireOptionalNativeModule<Recognition>("ExpoSpeechRecognition");
const speaker = requireOptionalNativeModule<Speaker>("LeetLogicLocalSpeech");
let cancelListening: (() => void) | undefined;
export const speechSetupMessage =
  "Voice listing is unavailable right now. You can continue by typing. Your saved answers will be kept.";
export const serverVoiceEnabled = process.env.EXPO_PUBLIC_LISTING_VOICE_PROVIDER === "server";
export async function finishListingAnswer() {
  if (serverVoiceEnabled) (await import("./server-listing-speech")).finishServerAnswer();
  else recognition?.stop();
}
export async function localSpeechAvailable(): Promise<string | null> {
  if (serverVoiceEnabled) return (await import("./server-listing-speech")).serverSpeechAvailable();
  if (
    Platform.OS === "web" ||
    !recognition ||
    !speaker ||
    (Platform.OS === "android" && !recognition.supportsOnDeviceRecognition())
  )
    return null;
  if (!(await speaker.available())) return null;
  const installedLocales =
    Platform.OS === "ios"
      ? (await speaker.englishRecognitionLocales?.()) || []
      : (
          await recognition.getSupportedLocales({
            androidRecognitionServicePackage: "com.google.android.as",
          })
        ).installedLocales;
  const english = installedLocales.filter((locale) => /^en[-_]/i.test(locale));
  return (
    ["en-NG", "en-GB", "en-US"].find((locale) => english.includes(locale)) || english[0] || null
  );
}
export async function requestLocalSpeechPermission() {
  if (serverVoiceEnabled)
    return (await import("./server-listing-speech")).requestServerSpeechPermission();
  if (!recognition) throw new Error(speechSetupMessage);
  const permission = await recognition.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Microphone and speech permission are needed. You can enable them in device settings or choose Type.",
    );
}
export async function speakListing(text: string) {
  if (serverVoiceEnabled) return (await import("./server-listing-speech")).speakServerListing(text);
  if (!speaker) throw new Error(speechSetupMessage);
  try {
    await speaker.speak(text);
  } catch {
    throw new Error(speechSetupMessage);
  }
}
export async function stopListingSpeech() {
  if (serverVoiceEnabled)
    return (await import("./server-listing-speech")).stopServerListingSpeech();
  cancelListening?.();
  recognition?.abort();
  await speaker?.stop();
}
/** One bounded turn, final transcript only, no persisted audio, no network fallback. */
export function listenListing(locale: string, onTranscribing?: () => void): Promise<string> {
  if (serverVoiceEnabled)
    return import("./server-listing-speech").then((module) =>
      module.listenServerListing(locale, onTranscribing),
    );
  if (!recognition) return Promise.reject(new Error(speechSetupMessage));
  cancelListening?.();
  return new Promise((resolve, reject) => {
    let settled = false;
    const subscriptions: { remove(): void }[] = [];
    let timer: ReturnType<typeof setTimeout>;
    const finish = (text?: string, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscriptions.forEach((s) => s.remove());
      cancelListening = undefined;
      recognition.abort();
      if (error) reject(error);
      else resolve(text!);
    };
    subscriptions.push(
      recognition.addListener("result", (event) => {
        if (event.isFinal && event.results[0]?.transcript.trim())
          finish(event.results[0].transcript.trim());
      }),
    );
    subscriptions.push(
      recognition.addListener("error", (event) =>
        finish(
          undefined,
          new Error(`Could not hear your answer (${event.error}). Try again or choose Type.`),
        ),
      ),
    );
    subscriptions.push(
      recognition.addListener("end", () =>
        finish(undefined, new Error("No clear answer was heard. Please try again.")),
      ),
    );
    cancelListening = () =>
      finish(undefined, new Error("Voice listing paused. Your confirmed answers are saved."));
    timer = setTimeout(
      () =>
        finish(
          undefined,
          new Error("Recording stopped after 30 seconds. Please give a shorter answer."),
        ),
      30_000,
    );
    try {
      recognition.start({
        lang: locale,
        requiresOnDeviceRecognition: true,
        interimResults: false,
        continuous: false,
        maxAlternatives: 1,
        recordingOptions: { persist: false },
        ...(Platform.OS === "android"
          ? { androidRecognitionServicePackage: "com.google.android.as" }
          : {}),
      });
    } catch (error) {
      finish(
        undefined,
        error instanceof Error
          ? error
          : new Error("Speech is unavailable. Choose Type or check device settings."),
      );
    }
  });
}
