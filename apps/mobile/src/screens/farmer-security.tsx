import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import { View, TextInput, Pressable, Switch, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import { LocalizedText as Text } from "../localization";
import { Button, Icon, colors, Heading, Label, Notice } from "../components/ui";
import { useApp } from "../state";
import { useFarmerBiometrics } from "../lib/use-farmer-biometrics";
import { sessionVersion } from "../lib/api";
import { checkPin, createSecurity, enableBiometric } from "../lib/farmer-security";

export function FarmerSecurity() {
  const a = useApp();
  const id = a.user!.id;
  const [step, setStep] = useState(a.security === "unlock" ? "unlock" : "create");
  const [pin, setPin] = useState("");
  const first = useRef("");
  const input = useRef<TextInput>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const auth = useFarmerBiometrics(id);
  const { presentation, available, enabled } = auth;
  const { label } = presentation;
  const mounted = useRef(true);
  const identity = useRef(id);
  identity.current = id;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const perform = async (task: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(a.error(e));
      setPin("");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const biometric = () =>
    perform(async () => {
      const version = sessionVersion();
      const current = await auth.refresh();
      if (!mounted.current || identity.current !== id || sessionVersion() !== version) return;
      if (!current.available || (step === "unlock" && !current.enabled)) {
        auth.failed();
        throw new Error("Biometric unlock is unavailable. Use your PIN.");
      }
      let result: LocalAuthentication.LocalAuthenticationResult;
      try {
        result = await LocalAuthentication.authenticateAsync({
          promptMessage: a.ui("Unlock LeetLogic"),
          disableDeviceFallback: true,
          biometricsSecurityLevel: "strong",
          cancelLabel: a.ui("Cancel"),
        });
      } catch (error) {
        auth.failed();
        throw error;
      }
      if (!mounted.current || identity.current !== id || sessionVersion() !== version) return;
      if (!result.success) {
        auth.failed();
        throw new Error("Device authentication was not completed. You can use your PIN instead.");
      }
      if (step === "unlock") {
        const latest = await auth.refresh();
        if (
          mounted.current &&
          identity.current === id &&
          sessionVersion() === version &&
          latest.enabled &&
          latest.available
        )
          a.unlock();
      } else {
        await enableBiometric(id, true);
        auth.setEnabled(true);
      }
    });
  const submit = (completedPin = pin) => {
    if (!/^\d{4}$/.test(completedPin) || step === "biometric") return;
    return perform(async () => {
      if (step === "unlock") {
        const version = sessionVersion();
        await checkPin(id, completedPin);
        if (mounted.current && identity.current === id && sessionVersion() === version) a.unlock();
        return;
      }
      if (step === "create") {
        first.current = completedPin;
        setPin("");
        setStep("confirm");
        return;
      }
      if (completedPin !== first.current)
        throw new Error("Your PINs do not match. Enter the first PIN again.");
      await createSecurity(id, completedPin);
      first.current = "";
      setPin("");
      auth.setEnabled(false);
      setStep("biometric");
    });
  };
  const title =
    step === "unlock"
      ? "Welcome back."
      : step === "create"
        ? "Create a PIN."
        : step === "confirm"
          ? "Confirm your PIN."
          : presentation.use;
  if (auth.loading)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper, padding: 24 }}>
        <StatusBar style="dark" />
        <Label>Checking…</Label>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.green }}>
      <StatusBar style="light" />
      <View style={{ height: 72, alignItems: "center", justifyContent: "center" }}>
        <Pressable
          accessibilityLabel={a.ui("Back")}
          disabled={busy}
          onPress={() => {
            if (step === "confirm") {
              first.current = "";
              setPin("");
              setStep("create");
            } else void a.signOut();
          }}
          style={{ position: "absolute", left: 16, padding: 12 }}
        >
          <Icon name="securityBack" nativeSize={{ width: 24, height: 24 }} />
        </Pressable>
        <Text style={{ color: "white", fontFamily: "NotoBold", fontSize: 17 }}>
          {step === "biometric" ? label : "Security PIN"}
        </Text>
      </View>
      <View style={{ flex: 1, backgroundColor: colors.paper }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 24, paddingTop: 28, gap: 20 }}
        >
          {step === "biometric" && (
            <View
              style={{
                width: 132,
                height: 132,
                borderRadius: 66,
                backgroundColor: colors.mint,
                alignSelf: "center",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: 46,
                  backgroundColor: colors.green,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={presentation.icon} nativeSize={{ width: 44, height: 44 }} />
              </View>
            </View>
          )}
          <Heading>{title}</Heading>
          <Label muted>
            {step === "unlock"
              ? auth.mode === "biometric"
                ? "Unlock with biometrics or enter your PIN."
                : "Enter your PIN to open your farmer account."
              : step === "confirm"
                ? "Enter the same 4 digits again."
                : step === "biometric"
                  ? "Unlock your farmer account using your device. You can still use your PIN."
                  : "4 digits. You will use this to open LeetLogic."}
          </Label>
          {step === "unlock" && auth.mode === "biometric" && (
            <Button title={presentation.use} disabled={busy} onPress={biometric} />
          )}
          {step !== "biometric" ? (
            <View>
              <Pressable
                accessibilityLabel={a.ui("Enter your 4-digit PIN")}
                onPress={() => input.current?.focus()}
                style={{
                  flexDirection: "row",
                  gap: 28,
                  justifyContent: "center",
                  height: 92,
                  alignItems: "center",
                }}
              >
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: colors.green,
                      backgroundColor: pin.length > i ? colors.green : "transparent",
                    }}
                  />
                ))}
              </Pressable>
              <TextInput
                ref={input}
                autoFocus
                accessibilityLabel={a.ui("Security PIN")}
                value={pin}
                onChangeText={(v) => {
                  if (pending.current) return;
                  const next = v.replace(/\D/g, "").slice(0, 4);
                  setPin(next);
                  setError("");
                  if (next.length === 4 && next !== pin) void submit(next);
                }}
                maxLength={4}
                keyboardType="number-pad"
                secureTextEntry
                autoComplete="off"
                style={{ position: "absolute", opacity: 0.01, width: "100%", height: 92 }}
                editable={!busy}
              />
            </View>
          ) : (
            <View style={{ backgroundColor: "white", padding: 20, borderRadius: 16, gap: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Label>{presentation.enable}</Label>
                  <Label muted>Device unlock</Label>
                </View>
                <Switch
                  accessibilityLabel={a.ui("Enable device unlock")}
                  value={enabled}
                  disabled={!available || busy}
                  trackColor={{ true: colors.action }}
                  onValueChange={(v) =>
                    v
                      ? biometric()
                      : void perform(async () => {
                          await enableBiometric(id, false);
                          auth.setEnabled(false);
                        })
                  }
                />
              </View>
              <Label muted>
                {available
                  ? "You can still use your PIN."
                  : "Set up biometrics in your device settings. You can continue with your PIN."}
              </Label>
            </View>
          )}
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: "white",
              borderRadius: 16,
              padding: 17,
            }}
          >
            <Label muted>
              Keep your PIN secret. LeetLogic staff will never ask for your PIN over the phone or by
              SMS.
            </Label>
          </View>
          {!!error && <Notice text={error} />}
          {step === "unlock" && (
            <Button
              title={auth.mode === "biometric" ? "Sign in with a code instead" : "Forgot your PIN?"}
              secondary
              disabled={busy}
              onPress={() => void perform(a.recoverSecurity)}
            />
          )}
          {step === "confirm" && (
            <Button
              title="Choose a different PIN"
              secondary
              disabled={busy}
              onPress={() => {
                first.current = "";
                setPin("");
                setStep("create");
              }}
            />
          )}
        </ScrollView>
        <View style={{ padding: 24 }}>
          <Button
            title={step === "biometric" ? "Done" : "Continue"}
            disabled={busy || (step !== "biometric" && pin.length !== 4)}
            loading={busy}
            onPress={step === "biometric" ? a.unlock : () => void submit()}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
