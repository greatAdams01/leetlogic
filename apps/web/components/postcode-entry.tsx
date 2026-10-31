"use client";
import { customerApi } from "../lib/customer-api";
import { useLanguage } from "./language-provider";
import { ui, localizedError } from "../../mobile/src/lib/localization";
import { usePostcode, type PostcodeControls } from "../../mobile/src/lib/use-postcode";
import { normalizeDigitalPostcode, postcodeStatus } from "../../../packages/contracts/src/addresses";

export function PostcodeEntry(props: Omit<PostcodeControls, "request">) {
  const { locale } = useLanguage();
  const say = (text: string) => ui(locale, text);
  const p = usePostcode({ ...props, request: (action, body) => customerApi(`me/postcodes/${action}`, body) });
  return <fieldset disabled={props.disabled}>
    <legend>{say("Digital postcode (optional)")}</legend>
    <label>{say("Digital postcode (optional)")}
      <input value={props.value} onChange={(e) => p.edit(e.target.value)} autoCapitalize="characters" autoComplete="postal-code" maxLength={40} />
    </label>
    <p>{say("Search uses postcode segments, not street names. Manual address entry is always available.")}</p>
    <button type="button" disabled={p.busy || !props.value.trim()} onClick={() => void p.find()}>{say("Search postcode")}</button>
    <button type="button" disabled={p.busy || !normalizeDigitalPostcode(props.value)} onClick={() => void p.lookup()}>{say("Check postcode")}</button>
    {props.coordinates && <button type="button" disabled={p.busy} onClick={() => void p.reverse()}>{say("Find postcode near map pin")}</button>}
    {p.search?.suggestions.map((suggestion) => <button type="button" key={suggestion.code} onClick={() => p.choose(suggestion.code)}>
      {suggestion.code}{suggestion.label ? ` — ${suggestion.label}` : ""}
    </button>)}
    {p.candidate && <button type="button" onClick={() => p.edit(p.candidate!.postcode)}>{say("Use nearby postcode")}: {p.candidate.postcode}</button>}
    {p.message && <p role="status">{say(p.message)}</p>}
    {p.pending && <div>
      <p>{p.pending.postcode}</p>
      <p>{say(postcodeStatus({ postalCode: p.pending.postcode, postcodeVerifiedAt: "checked", postcodeVerificationLevel: p.pending.level, postcodeVerificationMode: p.pending.mode }))}</p>
      {Object.entries(p.pending.fields).map(([key, value]) => <p key={key}>{value}</p>)}
      <button type="button" onClick={p.confirm}>{say("Use these postcode details")}</button>
    </div>}
    {!!p.error && <p role="alert">{localizedError(locale, p.error)}</p>}
    <button type="button" onClick={p.manual}>{say("Enter address manually")}</button>
  </fieldset>;
}
