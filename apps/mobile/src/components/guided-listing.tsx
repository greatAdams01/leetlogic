import React, { useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { AppSheet } from "./app-sheet";
import { Button, Label, Notice } from "./ui";
import {
  englishListing,
  interpretAnswer,
  commitAnswer,
  voiceFields,
  voiceCommand,
  listingReadback,
  type VoiceField,
  type VoiceCatalogue,
} from "../lib/guided-listing";
import {
  localSpeechAvailable,
  serverVoiceEnabled,
  finishListingAnswer,
  requestLocalSpeechPermission,
  speakListing,
  listenListing,
  stopListingSpeech,
  speechSetupMessage,
} from "../lib/local-listing-speech";
import { listingDetailsError, type ListingForm } from "../lib/listing-form";

export function GuidedListing({
  visible,
  form,
  catalogue,
  onChange,
  onClose,
  onDone,
  onActivityChange,
}: {
  visible: boolean;
  form: ListingForm;
  catalogue: VoiceCatalogue;
  onChange: (form: ListingForm) => void | Promise<void>;
  onClose: () => void;
  onDone: () => void;
  onActivityChange: (active: boolean) => void;
}) {
  const [phase, setPhase] = useState("Ready"),
    [message, setMessage] = useState(""),
    [transcript, setTranscript] = useState(""),
    [busy, setBusy] = useState(false),
    [unavailable, setUnavailable] = useState(false);
  const generation = useRef(0),
    latest = useRef(form),
    active = useRef(false);
  latest.current = form;
  const fields = voiceFields(form),
    cursor = fields.includes(form.voiceCursor as VoiceField)
      ? (form.voiceCursor as VoiceField)
      : fields[0]!;
  const pause = () => {
    generation.current++;
    active.current = false;
    setBusy(false);
    onActivityChange(false);
    void stopListingSpeech();
    setPhase("Paused");
  };
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") pause();
    });
    return () => {
      sub.remove();
      generation.current++;
      active.current = false;
      onActivityChange(false);
      void stopListingSpeech();
    };
  }, []);
  useEffect(() => {
    if (!visible) pause();
  }, [visible]);
  const run = async () => {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    onActivityChange(true);
    setMessage("");
    setUnavailable(false);
    const token = ++generation.current;
    const current = () => token === generation.current;
    const say = async (text: string) => {
      if (!current()) throw new Error("Paused");
      setPhase("Speaking");
      setMessage(text);
      await speakListing(text);
      if (!current()) throw new Error("Paused");
    };
    const hear = async () => {
      if (!current()) throw new Error("Paused");
      setPhase("Listening — speak now");
      const text = await listenListing(locale!, () => {
        if (current()) setPhase("Transcribing your answer…");
      });
      if (!current()) throw new Error("Paused");
      setTranscript(text);
      return text;
    };
    let locale: string | null = null;
    try {
      setPhase(serverVoiceEnabled ? "Checking voice service" : "Checking offline English speech");
      try {
        locale = await localSpeechAvailable();
      } catch {
        setUnavailable(true);
        throw new Error(speechSetupMessage);
      }
      if (!current()) return;
      if (!locale) {
        setUnavailable(true);
        throw new Error(speechSetupMessage);
      }
      await requestLocalSpeechPermission();
      if (!current()) return;
      let draft = latest.current;
      let field = cursor;
      while (current()) {
        const available = voiceFields(draft);
        let prompt = englishListing.prompts[field];
        if (field === "categoryId")
          prompt += ` Say the category name or number. ${catalogue.categories.map((c, i) => `${i + 1}: ${c.translations.find((t) => t.locale === "en")?.name || c.slug.replace(/-/g, " ")}`).join(". ")}.`;
        if (field === "addressId") {
          if (!catalogue.addresses.length)
            throw new Error(
              "Save your farm address in your farmer profile, then return to continue. Your confirmed answers are saved.",
            );
          prompt += ` ${catalogue.addresses.map((a, i) => `${i + 1}: ${a.line1}, ${a.city}, ${a.state}`).join(". ")}`;
        }
        await say(prompt);
        const raw = await hear(),
          command = voiceCommand(raw);
        const correction = /^change (.+)$/i.exec(raw.trim().replace(/[.!?]+$/, ""));
        const correctionFields: Record<string, VoiceField> = {
          name: "title",
          title: "title",
          "produce name": "title",
          "package units": "unitsPerPackage",
          category: "categoryId",
          description: "description",
          unit: "unitCode",
          quantity: "quantity",
          price: "price",
          address: "addressId",
          delivery: "shippingScope",
          packing: "packing",
          weight: "weightKg",
          length: "length",
          width: "width",
          height: "height",
          handling: "handling",
        };
        if (
          correction &&
          correctionFields[correction[1]!.toLowerCase()] &&
          available.includes(correctionFields[correction[1]!.toLowerCase()]!)
        ) {
          field = correctionFields[correction[1]!.toLowerCase()]!;
          draft = { ...draft, voiceCursor: field };
          await onChange(draft);
          continue;
        }
        if (command === "repeat") continue;
        if (command === "back") {
          field = available[Math.max(0, available.indexOf(field) - 1)]!;
          draft = { ...draft, voiceCursor: field };
          await onChange(draft);
          continue;
        }
        const answer = interpretAnswer(field, raw, draft, catalogue);
        if (!answer) {
          await say("I could not understand a valid answer. Let us try that question again.");
          continue;
        }
        let confirmed = false;
        while (current()) {
          await say(`I heard: ${answer.spoken}. Is that correct? Say yes or no.`);
          const confirmation = voiceCommand(await hear());
          if (confirmation === "yes") {
            confirmed = true;
            break;
          }
          if (confirmation === "no") break;
          await say("Please say yes to keep that answer, or no to record it again.");
        }
        if (!confirmed) continue;
        draft = commitAnswer(draft, field, answer);
        const next = voiceFields(draft),
          index = next.indexOf(field);
        if (index === next.length - 1) {
          const error = listingDetailsError(draft, catalogue.units);
          if (error) {
            await onChange({ ...draft, voiceCursor: field });
            throw new Error(error);
          }
          draft = { ...draft, voiceCursor: "title" };
          await onChange(draft);
          await say(
            `${listingReadback(draft, catalogue)} Next, add at least one clear photo. Use the camera or photo library buttons. The first photo is the cover. You will review everything before using the submit button.`,
          );
          if (current()) onDone();
          break;
        }
        field = next[index + 1]!;
        draft = { ...draft, voiceCursor: field };
        await onChange(draft);
      }
    } catch (error) {
      if (current()) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Voice listing paused. Try again or choose Type.",
        );
        setPhase("Paused");
      }
    } finally {
      if (current()) {
        active.current = false;
        setBusy(false);
        onActivityChange(false);
      }
    }
  };
  return (
    <AppSheet
      visible={visible}
      title="Guided voice listing"
      onShow={() => void run()}
      subtitle={
        serverVoiceEnabled
          ? "English · recordings sent to LeetLogic for transcription"
          : "English · processed on your device"
      }
      onClose={() => {
        pause();
        onClose();
      }}
      footer={
        <View style={{ gap: 10 }}>
          {serverVoiceEnabled && phase.startsWith("Listening") && (
            <Button title="Done speaking" onPress={() => void finishListingAnswer()} />
          )}
          {busy ? (
            <Button title="Pause" onPress={pause} />
          ) : (
            <Button
              title={unavailable ? "Continue by typing" : "Listen and answer"}
              onPress={() => {
                if (unavailable) {
                  pause();
                  onClose();
                } else void run();
              }}
            />
          )}
          <Button
            title={unavailable ? "Try voice again" : "Use Type instead"}
            secondary
            onPress={() => {
              if (unavailable) {
                void run();
              } else {
                pause();
                onClose();
              }
            }}
          />
        </View>
      }
    >
      <Label>{`Question ${fields.indexOf(cursor) + 1} of ${fields.length}`}</Label>
      <Label>{englishListing.prompts[cursor]}</Label>
      <Label>{phase}</Label>
      {!!transcript && <Label>{`You said: ${transcript}`}</Label>}
      {!!message && <Notice text={message} />}
      <Label>
        Listen to each question, then speak when the app says it is listening. Say repeat to hear a
        question again, or back to correct the previous answer. Confirmed answers are saved. Voice
        cannot submit a listing.
      </Label>
    </AppSheet>
  );
}

export function ReadListingAloud({ text }: { text: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const live = useRef(true);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        void stopListingSpeech();
        setBusy(false);
      }
    });
    return () => {
      live.current = false;
      sub.remove();
      void stopListingSpeech();
    };
  }, []);
  return (
    <View style={{ gap: 8 }}>
      <Button
        title={busy ? "Stop reading" : "Read listing aloud"}
        secondary
        onPress={() => {
          if (busy) {
            void stopListingSpeech();
            setBusy(false);
            return;
          }
          setBusy(true);
          setError("");
          void speakListing(text)
            .catch((e) => {
              if (live.current) setError(e.message);
            })
            .finally(() => {
              if (live.current) setBusy(false);
            });
        }}
      />
      {!!error && <Notice text={error} />}
    </View>
  );
}
