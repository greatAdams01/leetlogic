import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { readSecurity } from "./farmer-security";
import { biometricPresentation } from "./biometric-presentation";

/** Device enrollment is capability, never the account's consent to use biometrics. */
export async function readBiometricState(id: string) {
  const [record, hardware, types, enrolled, level] = await Promise.allSettled([
    Promise.resolve().then(() => readSecurity(id)),
    Promise.resolve().then(() => LocalAuthentication.hasHardwareAsync()),
    Promise.resolve().then(() => LocalAuthentication.supportedAuthenticationTypesAsync()),
    Promise.resolve().then(() => LocalAuthentication.isEnrolledAsync()),
    Promise.resolve().then(() => LocalAuthentication.getEnrolledLevelAsync()),
  ]);
  const supported = types.status === "fulfilled" ? types.value : [];
  return {
    id,
    enabled: record.status === "fulfilled" && record.value?.biometric === true,
    available:
      hardware.status === "fulfilled" &&
      hardware.value === true &&
      supported.length > 0 &&
      enrolled.status === "fulfilled" &&
      enrolled.value === true &&
      level.status === "fulfilled" &&
      level.value === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG,
    presentation: biometricPresentation(
      supported.includes(LocalAuthentication.AuthenticationType.FINGERPRINT),
      supported.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION),
      Platform.OS === "ios",
    ),
  };
}

export function useFarmerBiometrics(id: string) {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof readBiometricState>> | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++request.current;
    setSnapshot(null);
    const value = await readBiometricState(id);
    if (current === request.current) {
      setSnapshot(value);
    }
    return value;
  }, [id]);
  useEffect(() => {
    setFailed(false);
    void refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      ++request.current;
      subscription.remove();
    };
  }, [refresh]);
  const ready = snapshot?.id === id;
  return {
    loading: !ready,
    enabled: ready && snapshot.enabled,
    available: ready && snapshot.available,
    mode: !ready
      ? ("loading" as const)
      : snapshot.enabled && snapshot.available && !failed
        ? ("biometric" as const)
        : ("pin" as const),
    presentation: ready
      ? snapshot.presentation
      : biometricPresentation(false, false, Platform.OS === "ios"),
    refresh,
    failed: () => setFailed(true),
    setEnabled: (enabled: boolean) =>
      setSnapshot((current) => (current?.id === id ? { ...current, enabled } : current)),
  };
}
