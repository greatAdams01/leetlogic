import { describe, expect, it } from "vitest";
import {
  editableVerification,
  farmDetailsValid,
  farmLocationValid,
  resumeVerification,
  verificationSteps,
  type FarmForm,
} from "./verification";
const farm: FarmForm = {
  farmName: "Ada Farms",
  farmType: "Crop farming",
  description: "",
  state: "Lagos",
  lga: "Ikeja",
  city: "Ikeja",
  line1: "12 Farm Road",
};
describe("farmer verification stages", () => {
  it("separates farm details from location, identity, evidence and final review", () => {
    expect(verificationSteps).toEqual([
      "details",
      "location",
      "identity",
      "document",
      "evidence",
      "review",
    ]);
    expect(farmDetailsValid({ ...farm, state: "", lga: "", city: "", line1: "" })).toBe(true);
    expect(farmDetailsValid({ ...farm, farmName: " " })).toBe(false);
    expect(farmLocationValid(farm, ["Ikeja"])).toBe(true);
    expect(farmLocationValid({ ...farm, lga: "Abuja Municipal" }, ["Ikeja"])).toBe(false);
    expect(farmLocationValid({ ...farm, line1: " " }, ["Ikeja"])).toBe(false);
  });
  it("resumes from saved server evidence instead of a temporary uploaded flag", () => {
    expect(resumeVerification(0, 0)).toBe("identity");
    expect(resumeVerification(1, 0)).toBe("evidence");
    expect(resumeVerification(1, 2)).toBe("review");
    expect(resumeVerification(0, 2)).toBe("identity");
  });
  it("allows draft/correction work and locks all submitted or decided applications", () => {
    for (const status of ["NOT_STARTED", "DRAFT", "RESUBMISSION_REQUIRED"])
      expect(editableVerification(status)).toBe(true);
    for (const status of ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "UNKNOWN"])
      expect(editableVerification(status)).toBe(false);
  });
});
