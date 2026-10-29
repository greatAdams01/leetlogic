import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Pressable,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import { LocalizedText as Text } from "../localization";
import { Page, Card, Label, Field, Button, Notice, Icon, colors } from "../components/ui";
import { useApp, useResource } from "../state";
import { api, sessionVersion } from "../lib/api";
import { checkPin, createSecurity, enableBiometric } from "../lib/farmer-security";
import { useFarmerBiometrics } from "../lib/use-farmer-biometrics";

type PhoneSession = { id: string; current: boolean; createdAt: string; lastUsedAt: string | null };
type Panel = "pin" | "biometric" | "phones" | null;
export function SecuritySettings() {
  const a = useApp();
  const [panel, setPanel] = useState<Panel>(null);
  const [pin, setPin] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const pending = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const auth = useFarmerBiometrics(a.user!.id);
  const { enabled, available } = auth;
  const phones = useResource<{ items: PhoneSession[] }>("/auth/sessions");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const open = (next: Panel) => {
    if (pending.current) return;
    setPin("");
    setNextPin("");
    setConfirm("");
    setError("");
    setPanel(next);
  };
  const perform = async (task: (active: () => boolean) => Promise<void>) => {
    if (pending.current) return;
    const version = sessionVersion();
    const active = () => mounted.current && sessionVersion() === version;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await checkPin(a.user!.id, pin);
      if (!active()) return;
      await task(active);
      if (active()) setPin("");
    } catch (e) {
      if (active()) setError(a.error(e));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const updateBiometric = () =>
    void perform(async (active) => {
      const current = await auth.refresh();
      if (!active()) return;
      const value = !current.enabled;
      if (value) {
        if (!current.available) throw new Error("Biometric unlock is unavailable. Use your PIN.");
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: a.ui("Unlock LeetLogic"),
          disableDeviceFallback: true,
          biometricsSecurityLevel: "strong",
        });
        if (!active()) return;
        if (!result.success)
          throw new Error("Device authentication was not completed. You can use your PIN instead.");
      }
      await enableBiometric(a.user!.id, value);
      if (active()) {
        auth.setEnabled(value);
        setPanel(null);
        a.notify(value ? "Biometric unlock enabled." : "Biometric unlock disabled.");
      }
    });
  const settingIcon = (name: "settingsChangePin" | "settingsBiometric" | "settingsDevices") => (
    <View style={styles.iconTile}>
      <Icon name={name} nativeSize={{ width: 22, height: 22 }} />
    </View>
  );
  const heading = (title: string, subtitle: string, brown = false) => (
    <View style={styles.rowCopy}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={[styles.body, brown && { color: "#6b4a2f" }]}>{subtitle}</Text>
    </View>
  );
  const panelTitle =
    panel === "pin" ? "Change PIN" : panel === "biometric" ? "Biometric" : "Active phones";
  return (
    <Page
      contentStyle={styles.content}
      header={
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a.ui("Go back")}
            onPress={a.back}
            hitSlop={16}
          >
            <Icon name="settingsBack" nativeSize={{ width: 22, height: 22 }} />
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            Security
          </Text>
        </View>
      }
      footer={
        <View style={styles.footer}>
          <Icon name="settingsLock" nativeSize={{ width: 18, height: 18 }} />
          <Text style={styles.footerText}>Your PIN is stored securely on this phone</Text>
        </View>
      }
    >
      <Text style={styles.body}>
        Manage login security, device biometrics, and active connections.
      </Text>
      <Card style={styles.shield}>
        <Icon name="settingsShield" nativeSize={{ width: 32, height: 32 }} />
        <View style={styles.shieldCopy}>
          <Text style={styles.rowTitle}>
            {auth.loading ? "Checking…" : "Account Shield Active"}
          </Text>
          <Text style={styles.body}>
            {auth.loading
              ? "Checking…"
              : enabled && available
                ? "PIN + biometrics enabled"
                : "PIN protection enabled"}
          </Text>
        </View>
        {!auth.loading && <Text style={styles.good}>Good</Text>}
      </Card>
      <Card style={styles.settings}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={a.ui("Change PIN")}
          onPress={() => open("pin")}
          style={styles.row}
        >
          {settingIcon("settingsChangePin")}
          {heading("Change PIN", "Update your 4-digit account security PIN")}
          <Icon name="settingsChevron" nativeSize={{ width: 22, height: 22 }} />
        </Pressable>
        <View style={styles.divider} />
        <View style={styles.row}>
          {settingIcon("settingsBiometric")}
          {heading(
            "Biometric",
            "Use your device biometrics to securely unlock your farmer account",
          )}
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel={a.ui("Enable biometric unlock")}
            accessibilityState={{
              checked: enabled,
              disabled: busy || auth.loading || (!available && !enabled),
            }}
            disabled={busy || auth.loading || (!available && !enabled)}
            onPress={() => open("biometric")}
            hitSlop={8}
            style={{
              width: 52,
              height: 30,
              opacity: auth.loading || (!available && !enabled) ? 0.45 : 1,
            }}
          >
            {enabled ? (
              <Icon name="settingsSwitchOn" nativeSize={{ width: 52, height: 30 }} />
            ) : (
              <View style={styles.switchOff}>
                <View style={styles.switchThumb} />
              </View>
            )}
          </Pressable>
        </View>
        <View style={styles.divider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={a.ui("Active phones")}
          onPress={() => {
            open("phones");
            void phones.reload();
          }}
          style={styles.row}
        >
          {settingIcon("settingsDevices")}
          {heading(
            "Active phones",
            phones.loading
              ? "Checking…"
              : phones.error
                ? "View signed-in phones"
                : a.ui(
                    phones.data?.items.length === 1
                      ? "1 device logged in"
                      : "{count} devices logged in",
                    { count: phones.data?.items.length ?? 0 },
                  ),
            true,
          )}
          <Icon name="settingsChevron" nativeSize={{ width: 22, height: 22 }} />
        </Pressable>
      </Card>
      <Card style={styles.tip}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View style={styles.tipBadge}>
            <Text style={styles.tipTitle}>Security tip</Text>
          </View>
          <Text style={styles.body}>ⓘ</Text>
        </View>
        <Text style={styles.body}>
          Never share your 4-digit LeetLogic PIN with anyone. Our support agents will never ask for
          it.
        </Text>
      </Card>
      <Modal
        visible={panel !== null}
        transparent
        animationType="slide"
        onRequestClose={() => open(null)}
      >
        <View style={styles.overlay}>
          <SafeAreaView edges={["bottom"]} style={styles.sheet}>
            <KeyboardAvoidingView
              style={{ flexShrink: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                style={{ flexShrink: 1 }}
                contentContainerStyle={{ padding: 24, gap: 20 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Text style={[styles.rowTitle, { flex: 1 }]}>{panelTitle}</Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => open(null)}
                    hitSlop={12}
                  >
                    <Text style={{ ...styles.body, color: colors.green }}>Close</Text>
                  </Pressable>
                </View>
                {panel === "phones" ? (
                  <>
                    {phones.loading && <Label>Checking…</Label>}
                    {!!phones.error && <Notice text={phones.error} error />}
                    {phones.data?.items.map((phone, index) => (
                      <Card key={phone.id}>
                        <Label>
                          {phone.current
                            ? "This phone"
                            : a.ui("Phone {number}", { number: index + 1 })}
                        </Label>
                        <Label muted>{a.date(phone.lastUsedAt || phone.createdAt)}</Label>
                        {!phone.current && (
                          <Button
                            title="Sign out this phone"
                            secondary
                            disabled={busy || !/^\d{4}$/.test(pin)}
                            onPress={() =>
                              void perform(async (active) => {
                                await api(`/auth/sessions/${phone.id}`, { method: "DELETE" });
                                if (active()) await phones.reload();
                              })
                            }
                          />
                        )}
                      </Card>
                    ))}
                    <Field
                      label="Current PIN"
                      value={pin}
                      onChangeText={setPin}
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={4}
                      editable={!busy}
                    />
                    <Label muted>Enter your current PIN to sign out another phone.</Label>
                  </>
                ) : (
                  <>
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
                    {panel === "pin" ? (
                      <>
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
                          disabled={
                            busy ||
                            !/^\d{4}$/.test(pin) ||
                            !/^\d{4}$/.test(nextPin) ||
                            confirm !== nextPin
                          }
                          onPress={() =>
                            void perform(async (active) => {
                              await createSecurity(a.user!.id, nextPin);
                              if (enabled && active()) await enableBiometric(a.user!.id, true);
                              if (active()) {
                                setPanel(null);
                                setNextPin("");
                                setConfirm("");
                                a.notify("Your PIN has been updated.");
                              }
                            })
                          }
                        />
                      </>
                    ) : (
                      <>
                        <Label muted>You can still use your PIN.</Label>
                        <Button
                          title={enabled ? "Disable biometric unlock" : "Enable biometric unlock"}
                          disabled={
                            busy || auth.loading || (!available && !enabled) || !/^\d{4}$/.test(pin)
                          }
                          onPress={updateBiometric}
                        />
                      </>
                    )}
                  </>
                )}
                {!!error && <Notice text={error} error />}
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      </Modal>
    </Page>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  title: {
    flex: 1,
    fontFamily: "MontserratSemiBold",
    fontSize: 23,
    lineHeight: 30,
    color: colors.ink,
  },
  content: { padding: 24, gap: 24, paddingBottom: 24 },
  body: { fontFamily: "Noto", fontSize: 16, lineHeight: 23.2, color: colors.ink },
  shield: {
    backgroundColor: "#f2f0ec",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  shieldCopy: { flex: 1, gap: 4 },
  good: { fontFamily: "NotoBold", fontSize: 16, lineHeight: 23.2, color: colors.green },
  settings: { backgroundColor: "white", borderRadius: 16, padding: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 8 },
  iconTile: { padding: 12, borderRadius: 12, backgroundColor: "#f2f0ec" },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { fontFamily: "NotoBold", fontSize: 18, lineHeight: 26.1, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.line },
  switchOff: { height: 30, width: 52, borderRadius: 15, backgroundColor: colors.line, padding: 3 },
  switchThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: "white" },
  tip: { padding: 20, gap: 12, backgroundColor: "white", borderRadius: 16 },
  tipBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#fff0ce",
    borderRadius: 999,
  },
  tipTitle: { fontFamily: "NotoBold", fontSize: 14, lineHeight: 20.3, color: "#6b4a2f" },
  footer: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  footerText: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Noto",
    fontSize: 14,
    lineHeight: 20.3,
    color: colors.ink,
  },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "#00000055" },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
});
