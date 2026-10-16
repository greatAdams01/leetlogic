import data from "../data/nigeria-lgas.json";

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
