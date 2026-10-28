/** Hardware support does not reveal which biometric the user enrolled or prefers. */
export function biometricPresentation(fingerprint: boolean, face: boolean, ios: boolean) {
  if (fingerprint && !face)
    return {
      label: "Fingerprint",
      use: "Use fingerprint",
      enable: "Enable fingerprint",
      icon: "securityFingerprint" as const,
    };
  if (face && !fingerprint)
    return {
      label: ios ? "Face ID" : "Face unlock",
      use: ios ? "Use Face ID" : "Use face unlock",
      enable: ios ? "Enable Face ID" : "Enable face unlock",
      icon: "securityFace" as const,
    };
  return {
    label: "Biometric unlock",
    use: "Use biometric unlock",
    enable: "Enable biometric unlock",
    icon: "securityBiometric" as const,
  };
}
