import { Confirmation } from "../components/feedback";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { accountRoleKey } from "../lib/onboarding";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef, useState } from "react";
import { BackHandler, Image, Pressable, View } from "react-native";
import { LocalizedText as Text } from "../localization";
import { useApp } from "../state";
import { Page, Heading, Label, Field, Button, Card, Notice, colors, s } from "../components/ui";
import { Select } from "../components/Select";
import { api } from "../lib/api";
import { changeState, farmTypes, localGovernments, nigeriaStates } from "../lib/locations";
import {
  editableVerification,
  farmDetailsValid,
  farmLocationValid,
  resumeVerification,
  verificationSteps,
  type FarmForm,
  type VerificationStep,
} from "../lib/verification";
import { choosePhoto, photoBlob } from "./sell";

type Verification = {
  id: string;
  status: string;
  documents: { id: string; documentType: string }[];
  evidence: { id: string; note: string | null; hasPhoto?: boolean }[];
  reviews: { reason: string }[];
};
type Farmer = FarmForm & { primaryAddressId: string | null; verificationStatus: string };
const titles: Record<VerificationStep, string> = {
  details: "Seller profile · Farm details",
  location: "Farm location",
  identity: "Seller profile · Identity",
  document: "Seller profile · Check document",
  evidence: "Seller profile · Evidence",
  review: "Review seller application",
};
export function Seller() {
  const a = useApp();
  const [step, setStep] = useState<VerificationStep>("details");
  const [form, setForm] = useState<FarmForm>({
    farmName: "",
    farmType: "Crop farming",
    description: "",
    state: "",
    lga: "",
    city: "",
    line1: "",
  });
  const draftKey = `seller-onboarding-${a.user!.id}`;
  const draftWrites = useRef(Promise.resolve());
  const savedFarm = useRef<FarmForm | null>(null);
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [status, setStatus] = useState(a.user?.farmerProfile?.verificationStatus || "NOT_STARTED");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [documentType, setDocumentType] = useState("NIN_SLIP");
  const [photo, setPhoto] = useState<Awaited<ReturnType<typeof choosePhoto>>>(null);
  const [readable, setReadable] = useState(false);
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [declaration, setDeclaration] = useState(false);
  const requestActive = useRef(false);
  const [editing, setEditing] = useState(false);
  const mounted = useRef(true);
  const refresh = async () => {
    const result = await api<{ farmer: Farmer; verification: Verification }>(
      "/seller/verification",
    );
    setVerification(result.verification);
    setStatus(result.verification.status);
    return result;
  };
  const initialize = async () => {
    setError("");
    try {
      await AsyncStorage.setItem(accountRoleKey(a.user!.id), "SELLER");
      let currentStatus = status;
      if (status === "APPROVED") {
        setReady(true);
        return;
      }
      if (a.user?.farmerProfile) {
        const result = await api<{ farmer: Farmer; verification: Verification }>(
          "/seller/verification",
        );
        if (!mounted.current) return;
        const address = a.user.addresses.find((ad) => ad.id === result.farmer.primaryAddressId);
        const restoredForm: FarmForm = {
          farmName: result.farmer.farmName,
          farmType: result.farmer.farmType,
          description: result.farmer.description || "",
          state: address?.state || "",
          lga: address?.lga || "",
          city: address?.city || "",
          line1: address?.line1 || "",
        };
        setForm(restoredForm);
        savedFarm.current = restoredForm;
        setVerification(result.verification);
        setStatus(result.verification.status);
        currentStatus = result.verification.status;
        const latestNote = result.verification.evidence.filter((e) => e.note).at(-1)?.note || "";
        setNote(latestNote);
        setSavedNote(latestNote);
        setDocumentType(result.verification.documents.at(-1)?.documentType || "NIN_SLIP");
        setStep(
          result.verification.status === "RESUBMISSION_REQUIRED"
            ? "details"
            : resumeVerification(
                result.verification.documents.length,
                latestNote.trim().length >= 3 ? result.verification.evidence.length : 0,
              ),
        );
      }
      // Private form drafts are scoped to the authenticated account, never shared across users.
      try {
        const raw = await SecureStore.getItemAsync(draftKey);
        const draft = raw ? JSON.parse(raw) : null;
        if (
          draft &&
          editableVerification(currentStatus) &&
          verificationSteps.includes(draft.step)
        ) {
          const validForm =
            draft.form && Object.keys(form).every((key) => typeof draft.form[key] === "string");
          if (validForm && ["details", "location"].includes(draft.step)) {
            setForm(draft.form);
            setStep(
              draft.step === "location" && !farmDetailsValid(draft.form) ? "details" : draft.step,
            );
          } else if (a.user?.farmerProfile && draft.step === "document") {
            setStep("document");
          }
        }
      } catch {
        // A missing or invalid local draft falls back to authoritative server progress.
      }
      setReady(true);
    } catch (e) {
      if (mounted.current) setError(a.error(e));
    }
  };
  useEffect(() => {
    mounted.current = true;
    void initialize();
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    draftWrites.current = draftWrites.current
      .catch(() => {})
      .then(async () => {
        if (editableVerification(status))
          await SecureStore.setItemAsync(draftKey, JSON.stringify({ step, form }));
        else await SecureStore.deleteItemAsync(draftKey);
      });
    void draftWrites.current.catch(() => {});
  }, [ready, step, form, status, draftKey]);
  const move = (next: VerificationStep) => {
    setError("");
    setDeclaration(false);
    setStep(next);
  };
  const back = () => {
    if (requestActive.current) return;
    if (!editableVerification(status)) a.back();
    else if (editing) {
      if (savedFarm.current) setForm(savedFarm.current);
      setNote(savedNote);
      setPhoto(null);
      setDocumentType(verification?.documents.at(-1)?.documentType || "NIN_SLIP");
      setEditing(false);
      move("review");
    } else if (step === "details") a.back();
    else move(verificationSteps[verificationSteps.indexOf(step) - 1]!);
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => subscription.remove();
  });
  const run = async (fn: () => Promise<void>) => {
    if (requestActive.current) return;
    requestActive.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(a.error(e));
    } finally {
      requestActive.current = false;
      setBusy(false);
    }
  };
  const update = (key: keyof FarmForm, value: string) => {
    setDeclaration(false);
    setForm((f) => ({ ...f, [key]: value }));
  };
  const document = verification?.documents.filter((d) => d.documentType === documentType).at(-1);
  const edit = (next: VerificationStep) => {
    setEditing(true);
    move(next);
  };
  const continueTo = (next: VerificationStep) => {
    const target = editing ? "review" : next;
    setEditing(false);
    move(target);
  };
  const blocked = !editableVerification(status);
  let action: React.ReactNode;
  if (ready && !blocked) {
    if (step === "details")
      action = (
        <Button
          title="Continue"
          disabled={busy || !farmDetailsValid(form)}
          onPress={() => move("location")}
        />
      );
    if (step === "location")
      action = (
        <Button
          title={busy ? "Saving…" : "Save and continue"}
          disabled={
            busy ||
            !farmDetailsValid(form) ||
            !farmLocationValid(form, localGovernments(form.state))
          }
          onPress={() =>
            void run(async () => {
              await api("/me/seller-profile", { method: "POST", body: form });
              savedFarm.current = { ...form };
              await a.loadUser();
              await refresh();
              continueTo("identity");
            })
          }
        />
      );
    if (step === "identity")
      action = <Button title="Continue" disabled={busy} onPress={() => move("document")} />;
    if (step === "document")
      action = (
        <Button
          title={busy ? "Uploading…" : "Continue"}
          disabled={busy || (!photo && !document) || (!!photo && !readable)}
          onPress={() =>
            void run(async () => {
              if (photo) {
                await api(`/seller/verification/uploads?documentType=${documentType}`, {
                  method: "POST",
                  blob: await photoBlob(photo.uri, photo.mimeType),
                });
                await refresh();
                setPhoto(null);
                setReadable(false);
                a.notify("Identity document uploaded privately.");
              }
              continueTo("evidence");
            })
          }
        />
      );
    if (step === "evidence")
      action = (
        <Button
          title={busy ? "Saving…" : "Save and continue"}
          disabled={busy || note.trim().length < 3}
          onPress={() =>
            void run(async () => {
              if (note.trim() !== savedNote) {
                await api("/seller/verification/evidence", {
                  method: "POST",
                  body: { note: note.trim() },
                });
                setSavedNote(note.trim());
                await refresh();
              }
              continueTo("review");
            })
          }
        />
      );
    if (step === "review")
      action = (
        <Button
          title={busy ? "Submitting…" : "Submit seller application"}
          disabled={
            busy ||
            !declaration ||
            !verification?.documents.length ||
            !verification?.evidence.length
          }
          onPress={() =>
            void run(async () => {
              await api("/seller/verification/submit", {
                method: "POST",
                body: { declarationAccepted: true },
              });
              // Reflect successful submission even if refreshing the account fails.
              setStatus("SUBMITTED");
              a.notify("Application submitted");
              await a.loadUser();
            })
          }
        />
      );
  }
  return (
    <Page
      key={step + (blocked ? status : "")}
      title={blocked ? "Seller profile" : titles[step]}
      back={back}
      loading={!ready && !error}
      footer={
        action && (
          <>
            {step === "document" && photo && (
              <Confirmation
                checked={readable}
                disabled={busy}
                onChange={() => setReadable((v) => !v)}
                label="I can read the name and see all edges"
              />
            )}
            {step === "review" && !blocked && (
              <Confirmation
                checked={declaration}
                disabled={busy}
                onChange={() => setDeclaration((v) => !v)}
                label="I confirm that these details and identity documents are mine and accurate."
              />
            )}
            {action}
          </>
        )
      }
      backgroundColor={colors.white}
    >
      {!ready ? (
        error && (
          <>
            <Notice text={error} error />
            <Button title="Retry" onPress={() => void initialize()} />
          </>
        )
      ) : blocked ? (
        <>
          <Text style={s.badge}>{a.status(status)}</Text>
          {status === "APPROVED" ? (
            <>
              <Heading>Your farmer profile is approved.</Heading>
              <Button title="Create listing" onPress={() => a.go("sell")} />
            </>
          ) : status === "REJECTED" ? (
            <>
              <Heading>Your application was not approved.</Heading>
              <Label>Please contact support about your application.</Label>
              <Button title="Help and support" secondary onPress={() => a.go("help")} />
            </>
          ) : (
            <>
              <Heading>Application submitted</Heading>
              <Notice text="Your application is being reviewed. You can keep buying while you wait." />
            </>
          )}
          <Button
            title="Refresh"
            secondary
            disabled={busy}
            onPress={() =>
              void run(async () => {
                await refresh();
                await a.loadUser();
              })
            }
          />
        </>
      ) : (
        <>
          <Label muted>
            {a.ui("Step {step} of {total}", {
              step: verificationSteps.indexOf(step) + 1,
              total: verificationSteps.length,
            })}
          </Label>
          {status === "RESUBMISSION_REQUIRED" && (
            <Notice text="Changes are required before you submit again." />
          )}
          {status === "RESUBMISSION_REQUIRED" &&
            verification?.reviews.map((review, index) => (
              <Label key={index}>{review.reason}</Label>
            ))}
          {step === "details" && (
            <>
              <Heading>Tell us about your farm.</Heading>
              <View style={{ gap: 24 }}>
                <Field
                  label="Farm / business name *"
                  value={form.farmName}
                  maxLength={160}
                  onChangeText={(v) => update("farmName", v)}
                />
                <Select
                  label="Farm type *"
                  value={form.farmType}
                  options={farmTypes}
                  onChange={(v) => update("farmType", v)}
                />
                <Field
                  label="Description (optional)"
                  value={form.description}
                  maxLength={1000}
                  multiline
                  onChangeText={(v) => update("description", v)}
                />
              </View>
            </>
          )}
          {step === "location" && (
            <>
              <Heading>Farm location</Heading>
              <Label>Where is your farm or pickup point?</Label>
              <View style={{ gap: 24 }}>
                <Select
                  label="State *"
                  value={form.state}
                  options={nigeriaStates}
                  onChange={(state) => setForm((f) => changeState(f, state))}
                />
                <Select
                  label="Local government area *"
                  value={form.lga}
                  options={localGovernments(form.state)}
                  disabled={!form.state}
                  onChange={(v) => update("lga", v)}
                />
                <Field
                  label="City / town *"
                  value={form.city}
                  maxLength={100}
                  onChangeText={(v) => update("city", v)}
                />
                <Field
                  label="Full farm address *"
                  value={form.line1}
                  maxLength={180}
                  onChangeText={(v) => update("line1", v)}
                />
              </View>
            </>
          )}
          {step === "identity" && (
            <>
              <Heading>Choose your document.</Heading>
              <Label>Use one valid identity document that belongs to you.</Label>
              {["NIN_SLIP", "VOTER_CARD", "DRIVERS_LICENSE", "PASSPORT"].map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: documentType === value }}
                  style={[s.choice, documentType === value && s.selected]}
                  onPress={() => {
                    setDocumentType(value);
                    setPhoto(null);
                    setReadable(false);
                  }}
                >
                  <Label>{a.status(value)}</Label>
                </Pressable>
              ))}
              <Notice text="Your identity document stays private and is used only for verification." />
            </>
          )}
          {step === "document" && (
            <>
              <Heading>Is your document clear?</Heading>
              <Label>
                Check that the name, photo and all edges are readable before continuing.
              </Label>
              <Label>{a.status(documentType)}</Label>
              {photo && (
                <Image
                  source={{ uri: photo.uri }}
                  accessibilityLabel={a.ui("Identity document preview")}
                  style={{ height: 280, width: "100%" }}
                  resizeMode="contain"
                />
              )}
              {document && !photo && (
                <Notice text="Identity document uploaded privately." success />
              )}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  style={{
                    minHeight: 48,
                    justifyContent: "center",
                    paddingVertical: 12,
                    opacity: busy ? 0.5 : 1,
                  }}
                  onPress={() =>
                    void run(async () => {
                      const chosen = await choosePhoto(true);
                      if (chosen) {
                        setPhoto(chosen);
                        setReadable(false);
                      }
                    })
                  }
                >
                  <Text style={s.link}>Take identity photo</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  style={{
                    minHeight: 48,
                    justifyContent: "center",
                    paddingVertical: 12,
                    opacity: busy ? 0.5 : 1,
                  }}
                  onPress={() =>
                    void run(async () => {
                      const chosen = await choosePhoto();
                      if (chosen) {
                        setPhoto(chosen);
                        setReadable(false);
                      }
                    })
                  }
                >
                  <Text style={s.link}>
                    {photo || document ? "Replace identity photo" : "Choose identity photo"}
                  </Text>
                </Pressable>
              </View>
              <Notice text="Your identity document stays private and is used only for verification." />
            </>
          )}
          {step === "evidence" && (
            <>
              <Heading>Show your farm or business.</Heading>
              <Label>
                Explain what you grow and how the evidence belongs to your farm or business.
              </Label>
              <Field
                label="Supporting written note *"
                value={note}
                onChangeText={(v) => {
                  setNote(v);
                  setDeclaration(false);
                }}
                maxLength={2000}
                multiline
              />
              {verification?.evidence.some((e) => e.hasPhoto) && (
                <Notice text="Farm evidence uploaded privately." success />
              )}
              {evidencePhotos.map((uri) => (
                <Image
                  key={uri}
                  source={{ uri }}
                  accessibilityLabel={a.ui("Farm evidence preview")}
                  style={{ width: "100%", height: 180 }}
                  resizeMode="contain"
                />
              ))}
              <Button
                title="Add farm evidence photo"
                secondary
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    const chosen = await choosePhoto();
                    if (!chosen) return;
                    await api("/seller/verification/uploads?kind=evidence", {
                      method: "POST",
                      blob: await photoBlob(chosen.uri, chosen.mimeType),
                    });
                    setEvidencePhotos((photos) => [...photos, chosen.uri]);
                    await refresh();
                  })
                }
              />
              <Notice text="Your farm evidence stays private and is used only for verification." />
            </>
          )}
          {step === "review" && (
            <>
              <Heading>Check your details.</Heading>
              <Label>You can edit any section before submitting.</Label>
              <Card>
                <Text style={s.sectionTitle}>Farm profile</Text>
                <Label>{form.farmName}</Label>
                <Label>{a.ui(form.farmType)}</Label>
                <Label>{form.description}</Label>
                <Label>
                  {form.line1}, {form.city}, {form.lga}, {form.state}
                </Label>
                <Button title="Edit farm details" secondary onPress={() => edit("details")} />
              </Card>
              <Card>
                <Text style={s.sectionTitle}>Identity document</Text>
                {verification?.documents.map((d) => (
                  <Label key={d.id}>{a.status(d.documentType)}</Label>
                ))}
                <Button title="Edit identity document" secondary onPress={() => edit("identity")} />
              </Card>
              <Card>
                <Text style={s.sectionTitle}>Farm / business evidence note</Text>
                <Label>{savedNote}</Label>
                {verification?.evidence.some((e) => e.hasPhoto) && (
                  <Notice text="Farm evidence uploaded privately." success />
                )}
                <Button title="Edit farm evidence" secondary onPress={() => edit("evidence")} />
              </Card>
              <Notice text="After submission, your application is read-only while it is under review." />
            </>
          )}
        </>
      )}
      {ready && error && <Notice text={error} error />}
    </Page>
  );
}
