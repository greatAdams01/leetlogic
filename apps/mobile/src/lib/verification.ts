export type FarmForm = {
  farmName: string;
  farmType: string;
  description: string;
  state: string;
  lga: string;
  city: string;
  line1: string;
};
export type VerificationStep =
  "details" | "location" | "identity" | "document" | "evidence" | "review";
export const verificationSteps: VerificationStep[] = [
  "details",
  "location",
  "identity",
  "document",
  "evidence",
  "review",
];
export const editableVerification = (status: string) =>
  ["NOT_STARTED", "DRAFT", "RESUBMISSION_REQUIRED"].includes(status);
export function farmDetailsValid(form: FarmForm) {
  return form.farmName.trim().length >= 2 && !!form.farmType && form.description.length <= 1000;
}
export function farmLocationValid(form: FarmForm, lgas: readonly string[]) {
  return (
    !!form.state &&
    lgas.includes(form.lga) &&
    form.city.trim().length >= 2 &&
    form.line1.trim().length >= 5
  );
}
export function resumeVerification(documents: number, evidence: number): VerificationStep {
  return documents ? (evidence ? "review" : "evidence") : "identity";
}

export type FarmMedia = { hasPhoto?: boolean; mimeType?: string | null };
export function hasFarmMedia(evidence: readonly FarmMedia[]) {
  return evidence.some(
    (item) =>
      item.hasPhoto === true &&
      ["image/jpeg", "image/png", "video/mp4", "video/quicktime"].includes(item.mimeType || ""),
  );
}
