import AsyncStorage from "@react-native-async-storage/async-storage";
import { accountRoleKey } from "../lib/onboarding";
import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LocalizedText as Text } from "../localization";
import { useApp } from "../state";
import { Icon, Notice, colors } from "../components/ui";
import { api, API_URL, deviceId, saveSession } from "../lib/api";
import {
  maskedPhone,
  otpDigits,
  resendSeconds,
  phoneDigits,
  phoneInputError,
} from "../lib/auth-input";
import { normalizeNigerianPhone } from "../../../../packages/contracts/src/phone";

function VerificationLayout({
  children,
  otp = false,
  disabled = false,
}: {
  children: React.ReactNode;
  otp?: boolean;
  disabled?: boolean;
}) {
  const a = useApp();
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.green }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.paper }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[v.header, otp && v.otpHeader]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a.ui("Go back")}
            disabled={disabled}
            onPress={a.back}
            style={[v.back, !otp && { backgroundColor: "#ffffff1a" }]}
          >
            <Icon name={otp ? "otpBack" : "phoneBack"} nativeSize={{ width: 24, height: 24 }} />
          </Pressable>
          <Text accessibilityRole="header" style={otp ? v.otpHeaderTitle : v.headerTitle}>
            Verification
          </Text>
          {!otp && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={a.ui("Change role")}
              disabled={disabled}
              onPress={() => a.reset("role")}
              style={v.role}
            >
              <Text style={v.roleText}>Change role</Text>
            </Pressable>
          )}
        </View>
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
function ContinueButton({
  busy,
  disabled,
  onPress,
  verifying = false,
}: {
  busy: boolean;
  disabled?: boolean;
  onPress: () => void;
  verifying?: boolean;
}) {
  const a = useApp();
  const title = busy ? (verifying ? "Verifying…" : "Sending…") : "Continue";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a.ui(title)}
      accessibilityState={{ disabled: !!disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        v.continue,
        (disabled || busy) && v.continueDisabled,
        pressed && { opacity: 0.85 },
      ]}
    >
      {busy && <ActivityIndicator color={colors.green} style={{ marginRight: 10 }} />}
      <Text style={[v.continueText, (disabled || busy) && { color: "#9a968d", fontSize: 17 }]}>
        {title}
      </Text>
      {!disabled && !busy && (
        <View style={{ marginLeft: 8 }}>
          <Icon name="arrow" nativeSize={{ width: 20, height: 20 }} />
        </View>
      )}
    </Pressable>
  );
}
export function Phone() {
  const a = useApp();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const policy = async (path: "terms" | "privacy") => {
    const configured =
      path === "terms" ? process.env.EXPO_PUBLIC_TERMS_URL : process.env.EXPO_PUBLIC_PRIVACY_URL;
    const webOrigin =
      process.env.EXPO_PUBLIC_WEB_URL || (__DEV__ ? API_URL.replace(/:3000$/, ":3001") : "");
    const url = configured || (webOrigin ? `${webOrigin.replace(/\/$/, "")}/${path}` : "");
    if (!url || (!/^https:\/\//i.test(url) && !(__DEV__ && /^http:\/\//i.test(url)))) {
      setError(a.ui("This policy has not been published yet."));
      return;
    }
    try {
      await Linking.openURL(url);
    } catch (e) {
      setError(a.error(e));
    }
  };
  const submit = async () => {
    if (submitting.current) return;
    const validationError = phoneInputError(phone);
    if (validationError) {
      setError(a.ui(validationError));
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const value = normalizeNigerianPhone(phone);
      await api("/auth/otp/request", {
        method: "POST",
        body: { phone: value, deviceId: await deviceId() },
      });
      a.go("otp", value);
    } catch (e) {
      setError(a.error(e));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <VerificationLayout disabled={busy}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={v.phoneBody}>
        <Text accessibilityRole="header" style={v.heading}>
          Enter your phone number
        </Text>
        <Text style={v.explanation}>We’ll send a 6-digit code to confirm your number.</Text>
        <View style={v.phoneCard}>
          <Text style={v.phoneLabel}>Phone number</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={v.countryBadge}
              accessible
              accessibilityLabel={a.ui("Nigeria country code +234")}
            >
              <Icon name="nigeriaFlag" nativeSize={{ width: 24, height: 16 }} />
              <Text style={v.countryText}>+234</Text>
              <Icon name="countryLock" nativeSize={{ width: 14, height: 14 }} />
            </View>
            <TextInput
              accessibilityLabel={a.ui("Phone number")}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              placeholder="080****"
              placeholderTextColor="#96948d"
              value={phone}
              onChangeText={(value) => {
                setPhone(phoneDigits(value));
                setError("");
              }}
              editable={!busy}
              maxLength={11}
              autoCorrect={false}
              selectionColor={colors.green}
              style={v.phoneInput}
            />
          </View>
        </View>
        <View style={v.formatHint}>
          <View style={{ paddingTop: 2 }}>
            <Icon name="phoneFormatInfo" nativeSize={{ width: 20, height: 20 }} />
          </View>
          <Text style={v.formatText}>
            Enter 10 digits, or 11 digits starting with 0. The country code is already selected.
          </Text>
        </View>
        <View style={v.consent}>
          <Text style={v.consentText}>
            {a.ui("By continuing, you agree to our")}{" "}
            <Text
              accessibilityRole="link"
              style={v.policyLink}
              onPress={() => void policy("terms")}
            >
              Terms
            </Text>{" "}
            {a.ui("and")}{" "}
            <Text
              accessibilityRole="link"
              style={v.policyLink}
              onPress={() => void policy("privacy")}
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
        {error && (
          <View style={{ marginBottom: 16 }}>
            <Notice text={error} error />
          </View>
        )}
        <ContinueButton busy={busy} onPress={() => void submit()} />
      </ScrollView>
    </VerificationLayout>
  );
}
export function Otp() {
  const a = useApp();
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<TextInput>(null);
  const deadline = useRef(Date.now() + 60_000);
  const submitting = useRef(false);
  useEffect(() => {
    const update = () => setSeconds(resendSeconds(deadline.current));
    const timer = setInterval(update, 1000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  const verify = async () => {
    if (submitting.current || code.length !== 6) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api("/auth/otp/verify", {
        method: "POST",
        body: { phone: a.route.id, deviceId: await deviceId(), code },
      });
      await saveSession(result);
      const user = await a.loadUser();
      await AsyncStorage.setItem(accountRoleKey(user.id), a.role);
      await a.changeLocale(a.locale);
      a.reset(a.role === "SELLER" ? "seller" : "home");
      a.notify("Phone verified");
    } catch (e) {
      setError(a.error(e));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const resend = async () => {
    if (submitting.current || seconds > 0) return;
    submitting.current = true;
    setBusy(true);
    setResending(true);
    setError("");
    try {
      await api("/auth/otp/request", {
        method: "POST",
        body: { phone: a.route.id, deviceId: await deviceId() },
      });
      deadline.current = Date.now() + 60_000;
      setSeconds(60);
      setCode("");
    } catch (e) {
      setError(a.error(e));
    } finally {
      submitting.current = false;
      setBusy(false);
      setResending(false);
    }
  };
  return (
    <VerificationLayout otp disabled={busy}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={v.otpBody}>
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={v.heading}>
            Enter your verification code
          </Text>
          <Text style={[v.explanation, { marginTop: 0 }]}>
            {a.ui("Sent to {phone} · Valid for 5 minutes", {
              phone: maskedPhone(a.route.id || ""),
            })}
          </Text>
          <Pressable accessible={false} onPress={() => input.current?.focus()} style={v.codeRow}>
            {Array.from({ length: 6 }, (_, index) => {
              const active = index === code.length && (focused || code.length > 0);
              return (
                <View
                  key={index}
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[
                    v.codeBox,
                    (code[index] || active) && v.codeBoxFilled,
                    active && v.codeBoxActive,
                  ]}
                >
                  <Text style={v.codeDigit}>{code[index] || ""}</Text>
                  {active && <View style={v.codeCaret} />}
                </View>
              );
            })}
            <TextInput
              ref={input}
              accessibilityLabel={a.t("auth.code")}
              value={code}
              maxLength={32}
              selectTextOnFocus
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              autoCorrect={false}
              editable={!busy}
              onChangeText={(value) => {
                setCode(otpDigits(value));
                setError("");
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              caretHidden
              selectionColor="transparent"
              style={v.codeInput}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !!seconds || busy }}
            disabled={!!seconds || busy}
            onPress={() => void resend()}
            style={v.resend}
          >
            <Text style={v.resendText}>
              {seconds
                ? a.ui("Resend code in {time}", {
                    time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
                  })
                : a.ui("Resend code")}
            </Text>
          </Pressable>
          {error && <Notice text={error} error />}
        </View>
        <SafeAreaView edges={["bottom"]} style={v.otpFooter}>
          <ContinueButton
            verifying={!resending}
            busy={busy}
            disabled={code.length !== 6}
            onPress={() => void verify()}
          />
        </SafeAreaView>
      </ScrollView>
    </VerificationLayout>
  );
}
const v = StyleSheet.create({
  header: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: colors.green,
  },
  otpHeader: { minHeight: 72, paddingHorizontal: 16, paddingVertical: 16 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    flex: 1,
    fontFamily: "Montserrat",
    fontSize: 20,
    lineHeight: 28,
    color: "white",
    letterSpacing: -0.5,
  },
  otpHeaderTitle: {
    position: "absolute",
    left: 64,
    right: 64,
    textAlign: "center",
    fontFamily: "NotoBold",
    fontSize: 17,
    lineHeight: 26,
    letterSpacing: 0.425,
    color: "white",
  },
  role: {
    borderRadius: 999,
    backgroundColor: "#ffffff1a",
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 1,
  },
  roleText: {
    fontFamily: "NotoBold",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: "white",
    textTransform: "uppercase",
  },
  phoneBody: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  otpBody: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 16,
    justifyContent: "space-between",
  },
  heading: { fontFamily: "Montserrat", fontSize: 28, lineHeight: 35, color: colors.ink },
  explanation: { fontFamily: "Noto", fontSize: 16, lineHeight: 26, color: "#555555", marginTop: 8 },
  phoneCard: {
    minHeight: 106,
    borderWidth: 2,
    borderColor: colors.green,
    borderRadius: 16,
    backgroundColor: "white",
    padding: 16,
    gap: 8,
    marginTop: 24,
    marginBottom: 16,
  },
  phoneLabel: {
    fontFamily: "NotoBold",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: colors.green,
    textTransform: "uppercase",
  },
  countryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f5f5f4",
    borderWidth: 1,
    borderColor: "#e7e5e4",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  countryText: { fontFamily: "NotoBold", fontSize: 18, lineHeight: 28, color: colors.ink },
  phoneInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontFamily: "Montserrat",
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 0.6,
    color: colors.ink,
  },
  formatHint: { flexDirection: "row", gap: 12, marginBottom: 24 },
  formatText: { flex: 1, fontFamily: "Noto", fontSize: 14, lineHeight: 20, color: "#555555" },
  consent: { marginBottom: 24 },
  consentText: { fontFamily: "Noto", fontSize: 12, lineHeight: 18, color: "#555555" },
  policyLink: { fontFamily: "NotoBold", color: colors.green },
  continue: {
    minHeight: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.action,
  },
  continueDisabled: { backgroundColor: "#e2dfd7" },
  continueText: {
    fontFamily: "NotoBold",
    fontSize: 18,
    lineHeight: 28,
    color: colors.paper,
    textAlign: "center",
    flexShrink: 1,
  },
  codeRow: { flexDirection: "row", gap: 10, marginTop: 24, height: 64 },
  codeBox: {
    flex: 1,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d5d0c7",
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
  },
  codeBoxFilled: { borderWidth: 2, borderColor: colors.green },
  codeBoxActive: { boxShadow: "0px 0px 0px 2px rgba(31,111,80,0.2)" },
  codeDigit: { fontFamily: "Montserrat", fontSize: 24, lineHeight: 32, color: colors.ink },
  codeCaret: { position: "absolute", width: 2, height: 28, backgroundColor: colors.green },
  codeInput: {
    ...StyleSheet.absoluteFill,
    fontSize: 24,
    color: "transparent",
    backgroundColor: "transparent",
  },
  resend: { alignItems: "center", paddingTop: 24, paddingBottom: 8, minHeight: 56 },
  resendText: {
    fontFamily: "Noto",
    fontSize: 16,
    lineHeight: 24,
    color: "#777777",
    textAlign: "center",
  },
  otpFooter: { paddingTop: 16, paddingBottom: 8, marginTop: 24 },
});
