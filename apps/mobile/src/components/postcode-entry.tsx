import React from "react";
import { View } from "react-native";
import { useApp } from "../state";
import { api } from "../lib/api";
import { usePostcode, type PostcodeControls } from "../lib/use-postcode";
import { normalizeDigitalPostcode, postcodeStatus } from "../../../../packages/contracts/src/addresses";
import { Button, Field, Label, Notice } from "./ui";

export function PostcodeEntry(props: Omit<PostcodeControls, "request">) {
  const a = useApp();
  const p = usePostcode({ ...props, request: (action, body) => api(`/me/postcodes/${action}`, { method: "POST", body }) });
  return (
    <View style={{ gap: 12 }}>
      <Field label="Digital postcode (optional)" placeholder="FC-02-A09-DB-09"
        value={props.value} onChangeText={p.edit} editable={!props.disabled} autoCapitalize="characters" autoCorrect={false} maxLength={40} />
      <Label muted>Search uses postcode segments, not street names. Manual address entry is always available.</Label>
      <Button title="Search postcode" secondary disabled={p.busy || props.disabled || !props.value.trim()} onPress={() => void p.find()} />
      <Button title="Check postcode" secondary disabled={p.busy || props.disabled || !normalizeDigitalPostcode(props.value)} loading={p.busy} onPress={() => void p.lookup()} />
      {props.coordinates && <Button title="Find postcode near map pin" secondary disabled={p.busy || props.disabled} onPress={() => void p.reverse()} />}
      {p.search?.suggestions.map((suggestion) => <Button key={suggestion.code} title={suggestion.label ? `${suggestion.code} — ${suggestion.label}` : suggestion.code}
        secondary disabled={props.disabled} onPress={() => p.choose(suggestion.code)} />)}
      {p.candidate && <Button title={`${a.ui("Use nearby postcode")}: ${p.candidate.postcode}`} secondary disabled={props.disabled} onPress={() => p.edit(p.candidate!.postcode)} />}
      {p.message && <Notice text={a.ui(p.message)} />}
      {p.pending && <View style={{ gap: 12 }}>
        <Label>{p.pending.postcode}</Label>
        <Label muted>{a.ui(postcodeStatus({ postalCode: p.pending.postcode, postcodeVerifiedAt: "checked", postcodeVerificationLevel: p.pending.level, postcodeVerificationMode: p.pending.mode }))}</Label>
        {Object.entries(p.pending.fields).map(([key, value]) => <Label key={key}>{value}</Label>)}
        <Button title="Use these postcode details" secondary disabled={props.disabled} onPress={p.confirm} />
      </View>}
      {!!p.error && <Notice text={a.error(p.error)} error />}
      <Button title="Enter address manually" secondary disabled={props.disabled} onPress={p.manual} />
    </View>
  );
}
