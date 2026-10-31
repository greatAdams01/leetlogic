"use client";
import { useRef, useState } from "react";
import type { Address } from "../../mobile/src/lib/domain";
import { savedFarmPoint } from "../../mobile/src/lib/farm-location";
import { postcodeLocation } from "../../mobile/src/lib/locations";
import { nigeriaStateNames, postcodeStatus, type PostcodeLookup } from "../../../packages/contracts/src/addresses";
import { customerApi } from "../lib/customer-api";
import { useLanguage } from "./language-provider";
import { ui, localizedError } from "../../mobile/src/lib/localization";
import { PostcodeEntry } from "./postcode-entry";

const empty = { label: "", line1: "", line2: "", landmark: "", city: "", lga: "", state: "", postalCode: "" };
export function CustomerAddresses({ addresses, seller = false, onSaved }: {
  addresses: Address[]; seller?: boolean; onSaved: (address: Address) => Promise<unknown> | void;
}) {
  const { locale } = useLanguage();
  const say = (text: string) => ui(locale, text);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string>();
  const [proof, setProof] = useState<string | null>();
  const [check, setCheck] = useState<PostcodeLookup | null>(null);
  const [pin, setPin] = useState({ latitude: "", longitude: "" });
  const [pinConfirmed, setPinConfirmed] = useState(false);
  const [primary, setPrimary] = useState(!seller);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const running = useRef(false);
  const saveKey = useRef<string | undefined>(undefined);
  const coordinates = pinConfirmed && pin.latitude && pin.longitude
    ? savedFarmPoint(pin) : undefined;
  const reset = () => {
    saveKey.current = undefined;
    setForm(empty); setEditingId(undefined); setProof(undefined); setCheck(null);
    setPin({ latitude: "", longitude: "" }); setPinConfirmed(false); setPrimary(!seller);
  };
  const change = (key: keyof typeof empty, value: string) => {
    saveKey.current = undefined;
    setForm((current) => ({ ...current, [key]: value }));
    if (key !== "label") { setProof(null); setCheck(null); }
    if (["state", "lga", "city", "line1"].includes(key)) { setPin({ latitude: "", longitude: "" }); setPinConfirmed(false); }
  };
  const edit = (address: Address) => {
    saveKey.current = undefined;
    setEditingId(address.id); setProof(undefined); setCheck(null); setNotice("");
    setForm({ label: address.label || "Pickup address", state: address.state, lga: address.lga, city: address.city,
      line1: address.line1, line2: address.line2 || "", landmark: address.landmark || "", postalCode: address.postalCode || "" });
    const point = savedFarmPoint(address);
    setPin(point ? { latitude: String(point.latitude), longitude: String(point.longitude) } : { latitude: "", longitude: "" });
    setPinConfirmed(!!point); setPrimary(!!address.isDefaultDelivery);
  };
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (running.current) return;
    running.current = true; setBusy(true); setNotice(""); setFailed(false);
    try {
      if ((pin.latitude || pin.longitude) && !coordinates) throw { code: "ADDRESS_PIN_CONFIRMATION_REQUIRED" };
      const result = await customerApi(editingId ? `me/addresses/${editingId}` : "me/addresses", {
        ...form, postalCode: form.postalCode || null, verificationToken: proof,
        coordinates: coordinates || null, isDefaultDelivery: primary,
      }, editingId ? "PATCH" : "POST", editingId ? undefined : saveKey.current ??= crypto.randomUUID());
       reset(); setNotice(say(seller ? "Pickup location saved." : "Delivery address saved."));
       await onSaved(result.address);
    } catch (e) { setFailed(true); setNotice(localizedError(locale, e)); }
    finally { running.current = false; setBusy(false); }
  };
  return <section id="addresses">
    <h2>{say(seller ? "Pickup addresses" : "Saved addresses")}</h2>
    {addresses.map((address) => <article key={address.id}>
      <h3>{address.label || say("Farm location")}</h3>
      <p>{[address.line1, address.city, address.lga, address.state].join(", ")}</p>
      {address.landmark && <p>{address.landmark}</p>}
      {address.postalCode && <p>{address.postalCode}</p>}
      <p>{say(postcodeStatus(address))}</p>
      <button type="button" disabled={busy} onClick={() => edit(address)}>{say("Edit saved address")}</button>
    </article>)}
    <form aria-label={say("Save address")} onSubmit={save}>
      <h3>{say(editingId ? "Edit saved address" : seller ? "Different pickup address" : "Add a delivery address")}</h3>
      <PostcodeEntry value={form.postalCode} coordinates={coordinates} disabled={busy}
        revision={JSON.stringify([editingId, form.state, form.lga, form.city, form.line1])}
        onChange={(value) => change("postalCode", value)} onManual={() => { saveKey.current = undefined; setProof(null); setCheck(null); }}
        onVerified={(lookup) => {
          saveKey.current = undefined;
          if (Object.entries(lookup.fields).some(([key, value]) => value !== form[key as keyof typeof form])) { setPin({ latitude: "", longitude: "" }); setPinConfirmed(false); }
          setForm((current) => ({ ...postcodeLocation(current, lookup.fields), postalCode: lookup.postcode }));
          setProof(lookup.verificationToken); setCheck(lookup);
        }} />
      {check && <p role="status">{say(postcodeStatus({ postalCode: check.postcode, postcodeVerifiedAt: "checked", postcodeVerificationLevel: check.level, postcodeVerificationMode: check.mode }))}</p>}
      <fieldset disabled={busy}>
        {(["label", "line1", "city", "lga"] as const).map((key) => <label key={key}>
          {say({ label: "Address label", line1: "Full street address", city: "City / town", lga: "Local government area" }[key])}
          <input required value={form[key]} minLength={key === "label" ? 1 : key === "line1" ? 5 : 2}
            maxLength={{ label: 60, line1: 180, city: 100, lga: 80 }[key]} onChange={(e) => change(key, e.target.value)} />
        </label>)}
        <label>{say("State")}
          <select required value={form.state} onChange={(e) => { change("state", e.target.value); setForm((current) => ({ ...current, lga: "" })); }}>
            <option value="">—</option>{nigeriaStateNames.map((state) => <option key={state} value={state}>{state}</option>)}
          </select>
        </label>
        <label>{say("Additional directions (optional)")}<input maxLength={180} value={form.line2} onChange={(e) => change("line2", e.target.value)} /></label>
        <label>{say("Landmark (optional)")}<input maxLength={180} value={form.landmark} onChange={(e) => change("landmark", e.target.value)} /></label>
        <p>{say("Map pin (optional). Only enter coordinates you have confirmed.")}</p>
        {(["latitude", "longitude"] as const).map((key) => <label key={key}>{say(key === "latitude" ? "Latitude" : "Longitude")}
          <input type="number" step="any" min={key === "latitude" ? -90 : -180} max={key === "latitude" ? 90 : 180}
            value={pin[key]} onChange={(e) => { saveKey.current = undefined; setPin((current) => ({ ...current, [key]: e.target.value })); setPinConfirmed(false); setProof(null); setCheck(null); }} />
        </label>)}
        {(pin.latitude || pin.longitude) && <label><input type="checkbox" checked={pinConfirmed} onChange={(e) => { saveKey.current = undefined; setPinConfirmed(e.target.checked); }} />{say("I confirm this map pin identifies my address.")}</label>}
        {!seller && <label><input type="checkbox" checked={primary} onChange={(e) => { saveKey.current = undefined; setPrimary(e.target.checked); }} />{say("Primary delivery location")}</label>}
        <button disabled={busy}>{say(busy ? "Saving…" : seller ? "Save pickup address" : "Save address")}</button>
        {editingId && <button type="button" onClick={reset}>{say("Cancel")}</button>}
      </fieldset>
    </form>
    {notice && <p role={failed ? "alert" : "status"}>{notice}</p>}
  </section>;
}
