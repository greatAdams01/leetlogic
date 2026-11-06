import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { addressInputSchema, addressText, normalizeNigerianState } from "../../../../packages/contracts/src/addresses";
import { api, uuid } from "../lib/api";
import type { Address } from "../lib/domain";
import { resolveCheckoutLocation } from "../lib/checkout-location";
import { PostcodeEntry } from "./postcode-entry";
import { validCheckoutAddress } from "../lib/checkout-address";
import { savedFarmPoint, type FarmPoint } from "../lib/device-location";
import { changeState, localGovernments, nigeriaStates, postcodeLocation } from "../lib/locations";
import { useApp } from "../state";
import { AppSheet } from "./app-sheet";
import { FarmPin } from "./farm-pin";
import { Select } from "./Select";
import { Button, Card, Field, Label, Notice } from "./ui";

const blank = {
  label: "",
  line1: "",
  city: "",
  state: "",
  lga: "",
  line2: "",
  landmark: "",
  postalCode: "",
};
const requiredFields = ["label", "line1", "city", "state", "lga"] as const;
const locationFields = ["line1", "city", "state", "lga"] as const;
const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const missingFieldsFor = (form: typeof blank) => {
  const missing = requiredFields.filter(key => !addressInputSchema.shape[key].safeParse(form[key]).success);
  if (addressText(form).trim().length < 15 && !missing.includes("line1")) missing.push("line1");
  return missing;
};
export type CheckoutAddressDraft = {
  ownerId?: string;
  form: typeof blank;
  point?: FarmPoint;
  proof: string | null;
  code: boolean;
  codeBaseline: { postalCode: string; proof: string | null } | null;
  missingOnly: boolean;
  missingFields: (typeof requiredFields)[number][];
  hint: string;
  saveKey?: string;
};
type CheckoutDeliveryAddressProps = {
  address?: Address;
  onSaved: (address: Address) => void;
  onLocationSaved?: (address: Address) => void;
  disabled?: boolean;
  draft?: CheckoutAddressDraft;
  onDraftChange?: (draft: CheckoutAddressDraft) => void;
  onBusyChange?: (busy: boolean) => void;
};
/** Address entry with optional progression after saving a confirmed map location. */
export function CheckoutDeliveryAddress(props: CheckoutDeliveryAddressProps) {
  const a = useApp();
  // Address drafts and outstanding native operations belong to one signed-in account.
  return <CheckoutAddressEntry key={a.user?.id || "guest"} {...props} />;
}
function CheckoutAddressEntry({
  address,
  onSaved,
  onLocationSaved,
  disabled = false,
  draft,
  onDraftChange,
  onBusyChange,
}: CheckoutDeliveryAddressProps) {
  const a = useApp();
  const initial = draft?.ownerId === a.user?.id ? draft : undefined;
  const [form, setForm] = useState(initial?.form || blank);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mapBusy, setMapBusy] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [code, setCode] = useState(initial?.code || false);
  const [proof, setProof] = useState<string | null>(initial?.proof || null);
  const [missingOnly, setMissingOnly] = useState(initial?.missingOnly || false);
  const [missingFields, setMissingFields] = useState(initial?.missingFields || []);
  const needsDetails = useRef(!!initial?.point);
  const [error, setError] = useState("");
  const [hint, setHint] = useState(initial?.hint || "");
  const [point, setPoint] = useState<FarmPoint | undefined>(initial?.point);
  const running = useRef(false);
  const locating = useRef(false);
  const mapConfirming = useRef(false);
  const dirty = useRef(!!initial && (!!initial.point || Object.values(initial.form).some(Boolean)));
  const codeBaseline = useRef(initial?.codeBaseline || null);
  const pendingSaved = useRef<{ address: Address; advance: boolean; ownerId?: string } | null>(null);
  const active = useRef(true);
  const owner = useRef(a.user?.id);
  owner.current = a.user?.id;
  const controls = useRef({ disabled, onSaved, onLocationSaved });
  controls.current = { disabled, onSaved, onLocationSaved };
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      onBusyChange?.(false);
    };
  }, []);
  const saveKey = useRef<string | undefined>(initial?.saveKey);
  useEffect(() => {
    onDraftChange?.({ ownerId: owner.current, form, point, proof, code,
      codeBaseline: codeBaseline.current, missingOnly, missingFields, hint, saveKey: saveKey.current });
  }, [form, point, proof, code, missingOnly, missingFields, hint, busy, onDraftChange]);
  useEffect(() => {
    onBusyChange?.(busy || mapBusy || open || dismissing);
  }, [busy, mapBusy, open, dismissing, onBusyChange]);
  const valid = validCheckoutAddress(address);
  const canSave = addressInputSchema.safeParse({ ...form, coordinates: point, verificationToken: proof }).success &&
    addressText(form).trim().length >= 15;
  const blocked = () => !active.current || controls.current.disabled || running.current || locating.current || dismissing || !!pendingSaved.current;
  const resetDraft = () => {
    dirty.current = false;
    setForm(blank);
    setPoint(undefined);
    setCode(false);
    setProof(null);
    codeBaseline.current = null;
    setMissingOnly(false);
    setMissingFields([]);
    needsDetails.current = false;
    setHint("");
    saveKey.current = undefined;
  };
  const completeSaved = () => {
    const pending = pendingSaved.current;
    pendingSaved.current = null;
    if (active.current) setDismissing(false);
    if (!pending || !active.current || owner.current !== pending.ownerId) return;
    resetDraft();
    if (controls.current.disabled) return;
    controls.current.onSaved(pending.address);
    if (pending.advance) controls.current.onLocationSaved?.(pending.address);
  };
  const abandonCode = () => {
    if (blocked()) return;
    saveKey.current = undefined;
    if (codeBaseline.current) {
      const baseline = codeBaseline.current;
      setForm(current => ({ ...current, postalCode: baseline.postalCode }));
      setProof(baseline.proof);
    }
    codeBaseline.current = null;
    setCode(false);
  };
  const edit = (key: keyof typeof blank, value: string) => {
    if (blocked()) return;
    dirty.current = true;
    saveKey.current = undefined;
    if (["line1", "city", "state", "lga", "postalCode"].includes(key)) {
      setProof(null);
      if (key !== "postalCode" && codeBaseline.current)
        codeBaseline.current = { ...codeBaseline.current, proof: null };
    }
    if (key === "state") {
      value = normalizeNigerianState(value) || value;
      if (form.state && normalizeNigerianState(form.state) !== normalizeNigerianState(value)) setPoint(undefined);
      if (form.state !== value && missingOnly)
        setMissingFields(current => current.includes("lga") ? current : [...current, "lga"]);
    }
    setForm((current) =>
      key === "state" ? changeState(current, value) : { ...current, [key]: value },
    );
  };
  const save = async (
    details = form,
    coordinates = point,
    advance = !!coordinates,
    verificationToken = proof,
  ) => {
    if (running.current || controls.current.disabled || !active.current || dismissing || pendingSaved.current) return;
    const savingFor = owner.current;
    const parsed = addressInputSchema.safeParse({ ...details, coordinates, verificationToken });
    if (!parsed.success || addressText(details).trim().length < 15) {
      setHint(
        "Add an address name, street address, city, state and local government area to continue.",
      );
      setOpen(true);
      return;
    }
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api("/me/addresses", {
        method: "POST",
        key: (saveKey.current ??= uuid()),
        body: {
          ...parsed.data,
          postalCode: details.postalCode || null,
          verificationToken,
          coordinates: coordinates || null,
          isDefaultDelivery: true,
        },
      });
      if (!active.current || owner.current !== savingFor) return;
      if (!validCheckoutAddress(result?.address))
        throw new Error("We couldn’t confirm the saved address. Please try again.");
      // The write is complete: a failed/stale account refresh must not lose it or replay its proof.
      setProof(null);
      codeBaseline.current = null;
      await a.loadUser().catch(() => null);
      if (!active.current || owner.current !== savingFor) return;
      a.setUser(current => !current || current.id !== savingFor ? current : {
        ...current,
        addresses: [result.address, ...current.addresses.filter(saved => saved.id !== result.address.id)
          .map(saved => result.address.isDefaultDelivery ? { ...saved, isDefaultDelivery: false } : saved)],
      });
      pendingSaved.current = { address: result.address, advance, ownerId: savingFor };
      setDismissing(true);
      setOpen(false);
      if (!mapConfirming.current && !open) completeSaved();
    } catch (e) {
      if (active.current && owner.current === savingFor) {
        const errorCode = (e as { code?: string } | null)?.code;
        if (errorCode === "POSTCODE_VERIFICATION_EXPIRED" || errorCode === "POSTCODE_ADDRESS_MISMATCH") {
          setProof(null);
          if (codeBaseline.current) codeBaseline.current = { ...codeBaseline.current, proof: null };
          saveKey.current = undefined;
        }
        if (coordinates) needsDetails.current = true;
        setError(a.error(e));
      }
    } finally {
      running.current = false;
      if (active.current) setBusy(false);
    }
  };
  return (
    <View style={{ gap: 14 }}>
      <Card>
        <Label style={{ fontFamily: "NotoBold" }}>Delivery address</Label>
        <Label>{a.user?.profile?.fullName || "Delivery contact"}</Label>
        <Label muted>{a.user?.phoneE164}</Label>
        {valid ? (
          <>
            <Label>{address.label}</Label>
            <Label>
              {address.line1}, {address.city}, {address.state}
            </Label>
          </>
        ) : (
          <Notice text="Add a delivery address or confirm a location on the map before you continue." />
        )}
        <Button
          title={valid ? "Change Address" : "Add Address"}
          secondary
          disabled={disabled || busy || mapBusy || open || dismissing}
          onPress={() => {
            if (blocked() || mapBusy) return;
            if (!dirty.current && valid) {
              setForm({ ...blank, ...Object.fromEntries(Object.keys(blank).map(key =>
                [key, address[key as keyof typeof blank] || ""])) });
              setPoint(savedFarmPoint(address));
              dirty.current = true;
            }
            setError("");
            setOpen(true);
          }}
        />
      </Card>
      <FarmPin
        compact
        context="buyer"
        disabled={disabled || busy || open || dismissing}
        value={dirty.current ? point : savedFarmPoint(address)}
        onBusyChange={setMapBusy}
        onConfirmationClosed={() => {
          mapConfirming.current = false;
          if (pendingSaved.current) completeSaved();
          else if (active.current && !controls.current.disabled && needsDetails.current) setOpen(true);
        }}
        onConfirm={async (coordinates) => {
          if (blocked()) return;
          locating.current = true;
          mapConfirming.current = true;
          dirty.current = true;
          setBusy(true);
          setError("");
          saveKey.current = undefined;
          needsDetails.current = false;
          setPoint(coordinates);
          setCode(false);
          codeBaseline.current = null;
          const locatingFor = owner.current;
          try {
            const resolved = await resolveCheckoutLocation(coordinates);
            if (!active.current || owner.current !== locatingFor || controls.current.disabled) return;
            const { details, verificationToken } = resolved;
            const moved = !point || point.latitude !== coordinates.latitude || point.longitude !== coordinates.longitude;
            const base = moved ? { ...blank, label: form.label, line2: form.line2, landmark: form.landmark } : form;
            const fields = Object.fromEntries(locationFields.filter(key => details[key]).map(key => [key, details[key]]));
            const next = { ...postcodeLocation(base, fields), label: form.label.trim() ? form.label : details.label,
              postalCode: details.postalCode };
            const matchingAddress = locationFields.every(key => !form[key] || normalize(form[key]) === normalize(next[key]));
            if (!verificationToken && matchingAddress && form.postalCode) next.postalCode = form.postalCode;
            const nextProof = verificationToken || (matchingAddress ? proof : null);
            setForm(next);
            setMissingOnly(true);
            setMissingFields(missingFieldsFor(next));
            setProof(nextProof);
            if (addressInputSchema.safeParse({ ...next, coordinates, verificationToken: nextProof }).success &&
              addressText(next).trim().length >= 15)
              await save(next, coordinates, true, nextProof);
            else {
              needsDetails.current = true;
              setHint(
                "Your map location is saved. Only the missing address details are needed. A digital code is optional.",
              );
            }
          } catch (e) {
            if (active.current && owner.current === locatingFor) {
              needsDetails.current = true;
              setError(a.error(e));
            }
          } finally {
            locating.current = false;
            if (active.current) setBusy(false);
          }
        }}
      />
      {hint && !open && <Notice text={hint} />}
      {error && !open && <Notice text={error} error />}
      <AppSheet
        visible={open}
        title="Delivery address"
        testID="checkout-address"
        busy={busy}
        onDismiss={completeSaved}
        onClose={() => {
          if (!running.current && !locating.current) {
            setDismissing(true);
            setOpen(false);
          }
        }}
        footer={
          <Button
            title={busy ? "Saving…" : "Save address"}
            loading={busy}
            disabled={disabled || busy || dismissing || !canSave}
            onPress={() => void save()}
          />
        }
      >
        {(a.user?.addresses || []).filter(validCheckoutAddress).map((saved) => (
          <Button
            key={saved.id}
            title={`${saved.label} · ${saved.line1}, ${saved.city}`}
            secondary
            disabled={busy || disabled}
            onPress={() => {
              if (blocked()) return;
              pendingSaved.current = { address: saved, advance: false, ownerId: owner.current };
              setDismissing(true);
              setOpen(false);
            }}
          />
        ))}
        {hint && <Notice text={hint} />}
        {missingOnly && (
          <Card>
            <Label>
              {[form.line1, form.city, form.lga, form.state].filter(Boolean).join(", ")}
            </Label>
            <Button
              title="Edit resolved details"
              secondary
              disabled={busy || disabled}
              onPress={() => { if (!blocked()) setMissingOnly(false); }}
            />
          </Card>
        )}
        <Button
          title="Use a digital code (optional)"
          secondary
          disabled={busy || disabled}
          onPress={() => {
            if (blocked()) return;
            if (code) abandonCode();
            else {
              codeBaseline.current = { postalCode: form.postalCode, proof };
              setCode(true);
            }
          }}
        />
        {code && (
          <PostcodeEntry
            value={form.postalCode}
            coordinates={point}
            disabled={busy || disabled}
            revision={JSON.stringify([owner.current, form.state, form.lga, form.city, form.line1])}
            onChange={(value) => edit("postalCode", value)}
            onManual={abandonCode}
            onVerified={(lookup) => {
              if (blocked()) return;
              dirty.current = true;
              saveKey.current = undefined;
              const next = {
                ...postcodeLocation(form, lookup.fields),
                label: form.label || "Delivery address",
                postalCode: lookup.postcode,
              };
              if (
                point &&
                (["state", "lga", "city", "line1"] as const).some(
                  (key) => form[key] && normalize(next[key]) !== normalize(form[key]),
                )
              )
                setPoint(undefined);
              setForm(next);
              setProof(lookup.verificationToken || null);
              setCode(false);
              codeBaseline.current = null;
              setMissingOnly(true);
              setMissingFields(missingFieldsFor(next));
              setHint("Review your address details and save to continue.");
            }}
          />
        )}

        {(!missingOnly || missingFields.includes("label")) && (
          <Field
            label="Address name"
            placeholder="Home or office"
            value={form.label}
            maxLength={60}
            editable={!busy && !disabled}
            onChangeText={(value) => edit("label", value)}
          />
        )}
        {(!missingOnly || missingFields.includes("line1")) && (
          <Field
            label="Full street address"
            value={form.line1}
            maxLength={180}
            editable={!busy && !disabled}
            onChangeText={(value) => edit("line1", value)}
          />
        )}
        {(!missingOnly || missingFields.includes("city")) && (
          <Field
            label="City / town"
            value={form.city}
            maxLength={100}
            editable={!busy && !disabled}
            onChangeText={(value) => edit("city", value)}
          />
        )}
        {(!missingOnly || missingFields.includes("state")) && (
          <Select
            label="State"
            value={form.state}
            options={nigeriaStates}
            disabled={busy || disabled}
            onChange={(value) => edit("state", value)}
          />
        )}
        {(!missingOnly || missingFields.includes("lga")) && (
          <Select
            label="Local government area"
            value={form.lga}
            options={localGovernments(form.state)}
            disabled={busy || disabled || !form.state}
            onChange={(value) => edit("lga", value)}
          />
        )}
        <Field
          label="Additional directions (optional)"
          value={form.line2}
          maxLength={180}
          editable={!busy && !disabled}
          onChangeText={(value) => edit("line2", value)}
        />
        <Field
          label="Landmark (optional)"
          value={form.landmark}
          maxLength={180}
          editable={!busy && !disabled}
          onChangeText={(value) => edit("landmark", value)}
        />
        {error && <Notice text={error} error />}
      </AppSheet>
    </View>
  );
}
