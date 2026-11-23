import React, { useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { AppSheet } from "./app-sheet";
import { Button, Field, Label, Notice } from "./ui";
import { englishListing, interpretAnswer, commitAnswer, guidedListingForm, guidedProduceChoices, firstIncompleteVoiceField,
  voicePackagingOptions, listingReadback, type VoiceCatalogue } from "../lib/guided-listing";
import { localSpeechAvailable, finishListingAnswer, requestLocalSpeechPermission,
  speakListing, listenListing, stopListingSpeech, speechSetupMessage } from "../lib/local-listing-speech";
import { listingDetailsError, type ListingForm } from "../lib/listing-form";
import { saleUnitLabel } from "../../../../packages/contracts/src/sale-packaging";

export function GuidedListing({ visible, form: savedForm, catalogue, onChange, onClose, onDone, onActivityChange }: {
  visible: boolean; form: ListingForm; catalogue: VoiceCatalogue;
  onChange: (form: ListingForm) => void | Promise<void>;
  onClose: () => void; onDone: () => void; onActivityChange: (active: boolean) => void;
}) {
  const form = guidedListingForm(savedForm, catalogue);
  const produceChoices = guidedProduceChoices(catalogue);
  const [input, setInput] = useState(""), [message, setMessage] = useState(""),
    [transcript, setTranscript] = useState(""), [phase, setPhase] = useState(""),
    [busy, setBusy] = useState(false);
  const narration = useRef(0);
  const generation = useRef(0), active = useRef(false), saving = useRef(false);
  const cursor = firstIncompleteVoiceField(form, catalogue);
  const category = catalogue.categories.find(c => c.id === form.categoryId);
  const options = category ? voicePackagingOptions(category.slug, form.title, catalogue) : [];
  const option = options.find(o => o.value === form.salePackaging?.type);
  const unit = saleUnitLabel(form.salePackaging) || "selling unit";
  const numeric = !!cursor && ["quantity", "price", "salePackageSize", "unitsPerPackage", "weightKg", "length", "width", "height"].includes(cursor);
  const prompt = cursor === "quantity" ? `How many ${unit} do you have available?`
    : cursor === "price" ? `Price in naira per ${unit}`
    : cursor === "salePackaging" ? "Choose your selling package"
    : cursor === "salePackageSize" ? `Size of each package (${form.salePackaging?.measure || ""})`
    : cursor === "addressId" ? "Choose your pickup address"
    : cursor === "shippingScope" ? "Where can buyers order delivery?"
    : cursor === "packing" ? "Do you have the courier package measurements?"
    : cursor ? englishListing.prompts[cursor].replace(/ Say.*$/, "") : "Your listing details are ready";
  const pause = () => {
    narration.current++;
    generation.current++;
    active.current = false;
    setBusy(false); setPhase("");
    onActivityChange(false);
    void stopListingSpeech();
  };
  useEffect(() => {
    const sub = AppState.addEventListener("change", state => { if (state === "background") pause(); });
    return () => { sub.remove(); narration.current++; generation.current++; active.current = false; void stopListingSpeech(); onActivityChange(false); };
  }, []);
  useEffect(() => { if (!visible) pause(); }, [visible]);
  useEffect(() => {
    setMessage(""); setTranscript("");
    if (!cursor) { setInput(""); return; }
    const value = cursor === "salePackageSize" ? form.salePackaging?.size
      : cursor === "salePackageLabel" ? form.salePackaging?.customLabel
      : ["unitsPerPackage", "weightKg", "length", "width", "height"].includes(cursor)
        ? form.packaging?.[cursor as "weightKg"] : form[cursor as "title"];
    setInput(typeof value === "string" ? value : typeof value === "number" && value > 0 ? String(value) : "");
  }, [cursor, visible]);
  const parsed = cursor ? interpretAnswer(cursor, input, form, catalogue) : null;
  const record = async () => {
    if (active.current || saving.current) return;
    active.current = true; setBusy(true); onActivityChange(true); setMessage("");
    const token = ++generation.current;
    const current = () => token === generation.current;
    try {
      narration.current++;
      await stopListingSpeech();
      if (!current()) return;
      const locale = await localSpeechAvailable();
      if (!current()) return;
      if (!locale) throw new Error(speechSetupMessage);
      await requestLocalSpeechPermission();
      if (!current()) return;
      setPhase("Listening — speak now");
      const raw = await listenListing(locale, () => { if (current()) setPhase("Transcribing…"); });
      if (!current() || !cursor) return;
      const answer = interpretAnswer(cursor, raw, form, catalogue);
      setTranscript(raw);
      // Financial and package amounts always remain editable and require a tap to save.
      setInput(answer && numeric ? answer.value : raw);
      if (!answer) setMessage("Please edit the answer below, or record again.");
    } catch (error) {
      if (current()) setMessage(error instanceof Error ? error.message : "Please try again or type your answer.");
    } finally {
      if (current()) { active.current = false; setBusy(false); setPhase(""); onActivityChange(false); }
    }
  };
  const save = async (raw = input) => {
    if (active.current || saving.current) return;
    const answer = cursor && interpretAnswer(cursor, raw, form, catalogue);
    if (!cursor || !answer) { setMessage("Choose an option or enter a valid answer to continue."); return; }
    saving.current = true; setBusy(true); onActivityChange(true);
    try {
      let draft = commitAnswer(form, cursor, answer);
      if (cursor === "title") {
        const produce = produceChoices.find(p => p.title.toLowerCase() === answer.value.toLowerCase());
        if (produce) draft = commitAnswer(draft, "categoryId", { value: produce.categoryId, spoken: produce.title });
      }
      draft = guidedListingForm({ ...draft, voiceCursor: undefined }, catalogue);
      const next = firstIncompleteVoiceField(draft, catalogue);
      draft.voiceCursor = cursor === "salePackageLabel" ? "change:salePackageMeasure"
        : !next && cursor !== "shippingScope" ? "change:shippingScope" : next || "review";
      await onChange(draft);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save. Please try again."); }
    finally { saving.current = false; setBusy(false); onActivityChange(false); }
  };
  const choices: { label: string; value: string }[] =
    cursor === "title" ? produceChoices.map(p => ({ label: p.title, value: p.title }))
    : cursor === "description" ? ["Freshly harvested", "Clean and dry", "Ready for sale"].map(value => ({ label: value, value }))
    : cursor === "categoryId" ? catalogue.categories.map((c, i) => ({ label: c.translations.find(t => t.locale === "en")?.name || c.slug, value: String(i + 1) }))
    : cursor === "salePackaging" ? options.map((o, i) => ({ label: o.label, value: String(i + 1) }))
    : cursor === "salePackageSize" ? (option?.sizes || []).map(size => ({ label: `${size} ${form.salePackaging?.measure}`, value: String(size) }))
    : cursor === "salePackageMeasure" ? [{ label: "Kilograms", value: "kilograms" }, { label: "Litres", value: "litres" }, { label: "Pieces", value: "pieces" }]
    : cursor === "addressId" ? catalogue.addresses.map((a, i) => ({ label: `${a.line1}, ${a.city}, ${a.state}`, value: String(i + 1) }))
    : cursor === "shippingScope" ? [{ label: "Within my state", value: "local" }, { label: "Nationwide", value: "nationwide" }]
    : cursor === "packing" ? [{ label: "Enter measurements", value: "yes" }, { label: "Ask for packing assistance", value: "help" }]
    : cursor === "handling" ? ["Standard", "Perishable", "Cold chain", "Bulk"].map(label => ({ label, value: label })) : [];
  const spokenPrompt = cursor
    ? `${prompt}. ${choices.map(choice => choice.label).join(". ")}${choices.length ? ". Tap your choice." : " Type your answer or tap Answer by voice."}`
    : listingReadback(form, catalogue);
  useEffect(() => {
    if (!visible) return;
    const token = ++narration.current;
    let live = true;
    void (async () => {
      try {
        await stopListingSpeech();
        if (!live || token !== narration.current) return;
        await speakListing(spokenPrompt);
      } catch {
        if (live && token === narration.current)
          setMessage("Could not read this question aloud. You can still tap or type your answer.");
      }
    })();
    return () => { live = false; narration.current++; void stopListingSpeech(); };
  }, [visible, spokenPrompt]);
  const choiceOnly = !!cursor && ["categoryId", "salePackaging", "salePackageMeasure", "addressId", "shippingScope", "packing", "handling"].includes(cursor);
  const finish = async () => {
    if (saving.current || active.current) return;
    const error = listingDetailsError(form, catalogue.units, category?.slug);
    if (error) { setMessage(error); return; }
    saving.current = true; setBusy(true); onActivityChange(true);
    try {
      await onChange(form);
      pause();
      onDone();
    } catch { setMessage("Could not save. Please try again."); }
    finally { saving.current = false; setBusy(false); onActivityChange(false); }
  };
  return <AppSheet visible={visible} title="Create your listing" subtitle="Tap, type or speak — choose what is easiest"
    onClose={() => { pause(); onClose(); }} footer={<View style={{ gap: 10 }}>
      {busy ? <>
        {phase.startsWith("Listening") && <Button title="Done speaking" onPress={() => void finishListingAnswer()} />}
        {!saving.current && <Button title="Cancel recording" secondary onPress={pause} />}
      </> : <>
        {cursor && !choiceOnly && <Button title="Continue" disabled={!parsed} onPress={() => void save()} />}
        {!cursor && <Button title="Continue to photos and review" onPress={() => void finish()} />}
        {cursor && !choiceOnly && <Button title={transcript ? "Record again" : "Answer by voice"} secondary onPress={() => void record()} />}
        <Button title="Use full form" secondary onPress={() => { pause(); onClose(); }} />
      </>}
    </View>}>
    <Label>{prompt}</Label>
    {!!phase && <Label>{phase}</Label>}
    {choices.map(choice => <Button key={choice.value} title={choice.label} secondary disabled={busy} onPress={() => void save(choice.value)} />)}
    {cursor === "addressId" && !choices.length && <Notice text="Save a farm address in your profile, then return to continue." />}
    {cursor && !choiceOnly && <Field label={numeric ? prompt : "Your answer"} value={input} editable={!busy}
      keyboardType={numeric ? "decimal-pad" : "default"} multiline={cursor === "description"}
      onChangeText={value => { setInput(value); setMessage(""); }} />}
    {!!transcript && <Label>{`You said: ${transcript}`}</Label>}
    {parsed && !choiceOnly && <Label>{`Check your answer: ${parsed.spoken}`}</Label>}
    {form.packingAssistanceRequested && <Notice text="Our team will complete missing measurements during listing review before approving it for buyers." />}
    {!cursor && <Label>{`Pickup: ${catalogue.addresses.find(a => a.id === form.addressId)?.line1 || "Choose your farm address"}. Next, add photos and review your package, stock, price and estimated earnings before submitting.`}</Label>}
    {!!message && <Notice text={message} />}
    <Label>Tap Continue to save each answer. You can edit everything before submitting your listing.</Label>
  </AppSheet>;
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
