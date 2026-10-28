import React, { useEffect, useRef, useState } from "react";
import { Platform, Switch } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { Page, Card, Label, Field, Button, Notice, Icon } from "../components/ui";
import { useApp } from "../state";
import { checkPin, createSecurity, enableBiometric, readSecurity } from "../lib/farmer-security";
import { biometricPresentation } from "../lib/biometric-presentation";

export function SecuritySettings() {
  const a = useApp();
  const [pin, setPin] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [presentation, setPresentation] = useState(
    biometricPresentation(false, false, Platform.OS === "ios"),
  );
  useEffect(() => {
    let active = true;
    void Promise.all([
      readSecurity(a.user!.id),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ])
      .then(([record, types, enrolled]) => {
        if (!active) return;
        setEnabled(!!record?.biometric);
        setAvailable(enrolled && types.length > 0);
        setPresentation(
          biometricPresentation(
            types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT),
            types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION),
            Platform.OS === "ios",
          ),
        );
      })
      .catch((e) => {
        if (active) setError(a.error(e));
      });
    return () => {
      active = false;
    };
  }, [a.user?.id]);
  const perform = async (task: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await checkPin(a.user!.id, pin);
      await task();
      setPin("");
    } catch (e) {
      setError(a.error(e));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <Page title="Security settings" back={a.back}>
      <Label muted>Enter your current PIN to change your security settings.</Label>
      <Field
        label="Current PIN"
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        editable={!busy}
      />
      <Card>
        <Card style={{ backgroundColor: "#14532d", alignSelf: "flex-start" }}>
          <Icon name={presentation.icon} size={44} />
        </Card>
        <Label>{presentation.enable}</Label>
        <Switch
          accessibilityLabel={a.ui("Enable device unlock")}
          value={enabled}
          disabled={busy || !available || !/^\d{4}$/.test(pin)}
          onValueChange={(value) =>
            void perform(async () => {
              if (value) {
                const result = await LocalAuthentication.authenticateAsync({
                  promptMessage: a.ui("Unlock LeetLogic"),
                  disableDeviceFallback: true,
                  biometricsSecurityLevel: "strong",
                });
                if (!result.success)
                  throw new Error(
                    "Device authentication was not completed. You can use your PIN instead.",
                  );
              }
              await enableBiometric(a.user!.id, value);
              setEnabled(value);
            })
          }
        />
        <Label muted>
          {available
            ? "You can still use your PIN."
            : "Set up biometrics in your device settings. You can continue with your PIN."}
        </Label>
      </Card>
      <Card>
        <Field
          label="New PIN"
          value={nextPin}
          onChangeText={setNextPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          editable={!busy}
        />
        <Field
          label="Confirm new PIN"
          value={confirm}
          onChangeText={setConfirm}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          editable={!busy}
        />
        <Button
          title="Change PIN"
          disabled={busy || !/^\d{4}$/.test(pin) || !/^\d{4}$/.test(nextPin) || confirm !== nextPin}
          onPress={() =>
            void perform(async () => {
              await createSecurity(a.user!.id, nextPin);
              if (enabled) await enableBiometric(a.user!.id, true);
              setNextPin("");
              setConfirm("");
              a.notify("Your PIN has been updated.");
            })
          }
        />
      </Card>
      {!!error && <Notice text={error} error />}
    </Page>
  );
}
