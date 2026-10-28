import { describe, expect, it } from "vitest";
import { biometricPresentation } from "./biometric-presentation";

describe("biometric presentation", () => {
  it("does not claim face unlock when both sensors are supported", () => {
    for (const ios of [false, true]) {
      expect(biometricPresentation(true, true, ios).label).toBe("Biometric unlock");
    }
  });
  it("names a single supported modality and uses its icon", () => {
    expect(biometricPresentation(true, false, false)).toMatchObject({
      label: "Fingerprint",
      icon: "securityFingerprint",
    });
    expect(biometricPresentation(false, true, false)).toMatchObject({
      label: "Face unlock",
      icon: "securityFace",
    });
    expect(biometricPresentation(false, true, true).label).toBe("Face ID");
  });
  it("keeps unknown hardware generic", () => {
    expect(biometricPresentation(false, false, false).use).toBe("Use biometric unlock");
  });
});
