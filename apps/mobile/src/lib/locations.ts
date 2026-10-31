import data from "../data/nigeria-lgas.json";
import { normalizeNigerianState } from "../../../../packages/contracts/src/addresses";

const locations: Record<string, string[]> = data;
export const nigeriaStates = Object.keys(locations);
export const farmTypes = [
  "Crop farming",
  "Livestock farming",
  "Poultry farming",
  "Fish farming",
  "Mixed farming",
] as const;
export function localGovernments(state: string): string[] {
  return Object.hasOwn(locations, state) ? locations[state]! : [];
}
export function changeState<T extends { state: string; lga: string }>(form: T, state: string): T {
  return { ...form, state, lga: form.state === state ? form.lga : "" };
}
export function postcodeLocation<T extends { state: string; lga: string; city: string; line1: string }>(
  form: T, fields: Partial<Pick<T, "state" | "lga" | "city" | "line1">>,
): T {
  const state = fields.state ? normalizeNigerianState(fields.state) || form.state : form.state;
  const normalized = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const lga = fields.lga ? localGovernments(state).find((name) => normalized(name) === normalized(fields.lga!)) || fields.lga
    : state === form.state ? form.lga : "";
  return { ...form, ...fields, state, lga };
}
