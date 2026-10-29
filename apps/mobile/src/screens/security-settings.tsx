import React, { useEffect, useRef, useState } from "react";
import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { AppSheet } from "../components/app-sheet";
import * as LocalAuthentication from "expo-local-authentication";
import { LocalizedText as Text } from "../localization";
import { Page, Card, Label, Field, Button, Notice, Icon, colors } from "../components/ui";
import { useApp } from "../state";
import { api, sessionVersion } from "../lib/api";
import { checkPin, createSecurity, enableBiometric } from "../lib/farmer-security";
import { useFarmerBiometrics } from "../lib/use-farmer-biometrics";

import { useConnectedDevices, type ConnectedDevice } from "../lib/connected-devices";
type Panel = "pin" | "biometric" | "phones" | "revoke" | null;
export function SecuritySettings() {
  const a = useApp();
  const [panel, setPanel] = useState<Panel>(null);
  const [selectedDevice, setSelectedDevice] = useState<ConnectedDevice | null>(null);
  const [pin, setPin] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const pending = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const auth = useFarmerBiometrics(a.user!.id);
  const { enabled, available } = auth;
  const phones = useConnectedDevices(a.user!.id, a.locale);
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
    if (next !== "revoke") setSelectedDevice(null);
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
  const deviceName = (device: ConnectedDevice) =>
    device.deviceName || a.ui(device.current ? "This device" : "Device details unavailable");
  const platformName = (device: ConnectedDevice) =>
    device.platform === "ios"
      ? "iOS"
      : device.platform === "android"
        ? "Android"
        : device.platform === "web"
          ? a.ui("Web browser")
          : a.ui("Platform unavailable");
  const selectDevice = (device: ConnectedDevice) => {
    if (device.current || pending.current) return;
    open("revoke");
    setSelectedDevice(device);
  };
  const deviceCard = (device: ConnectedDevice, actionable: boolean) => (
    <Card
      key={device.id}
      style={{ ...styles.deviceCard, ...(device.current ? styles.currentDevice : {}) }}
    >
      <View style={styles.deviceHeader}>
        <View style={styles.deviceIcon}>
          <Icon
            name={
              device.platform === "ios" || device.platform === "android"
                ? "securityDevicePhone"
                : "settingsDevices"
            }
            nativeSize={
              device.platform === "ios" || device.platform === "android"
                ? { width: 24, height: 24 }
                : { width: 22, height: 22 }
            }
          />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={styles.deviceName}>{deviceName(device)}</Text>
          <Text style={styles.devicePlatform}>{platformName(device)}</Text>
        </View>
        {actionable && !device.current && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a.ui("Sign out {device}", { device: deviceName(device) })}
            accessibilityHint={a.ui("Review this device and confirm with your PIN")}
            disabled={busy}
            onPress={() => selectDevice(device)}
            style={styles.iconAction}
          >
            <Icon name="securityDeviceSignout" nativeSize={{ width: 20, height: 20 }} />
          </Pressable>
        )}
      </View>
      {device.current && (
        <View style={styles.currentBadge}>
          <Text style={styles.currentBadgeText}>This device</Text>
        </View>
      )}
      <View style={styles.deviceActivity}>
        <Icon name="securityDeviceClock" nativeSize={{ width: 18, height: 18 }} />
        <Text style={styles.activityText}>
          {device.lastUsedAt
            ? a.ui("Last active {date}", { date: a.date(device.lastUsedAt) })
            : a.ui("Activity not recorded yet")}
        </Text>
      </View>
    </Card>
  );
  const panelTitle =
    panel === "pin"
      ? "Change PIN"
      : panel === "biometric"
        ? "Biometric"
        : panel === "revoke"
          ? "Sign out device"
          : "Signed-in devices";
  const footer =
    panel === "pin" ? (
      <Button
        title="Change PIN"
        loading={busy}
        disabled={busy || !/^\d{4}$/.test(pin) || !/^\d{4}$/.test(nextPin) || confirm !== nextPin}
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
    ) : panel === "biometric" ? (
      <Button
        title={enabled ? "Disable biometric unlock" : "Enable biometric unlock"}
        loading={busy}
        disabled={busy || auth.loading || (!available && !enabled) || !/^\d{4}$/.test(pin)}
        onPress={updateBiometric}
      />
    ) : panel === "revoke" && selectedDevice ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a.ui("Sign out device")}
        accessibilityState={{ disabled: busy || !/^\d{4}$/.test(pin), busy }}
        disabled={busy || !/^\d{4}$/.test(pin)}
        style={[styles.revokeAction, (busy || !/^\d{4}$/.test(pin)) && { opacity: 0.45 }]}
        onPress={() =>
          void perform(async (active) => {
            if (!selectedDevice || selectedDevice.current) return;
            await api(`/auth/sessions/${selectedDevice.id}`, { method: "DELETE" });
            if (active()) {
              setPanel("phones");
              setSelectedDevice(null);
              a.notify("Device signed out.");
              await phones.reload();
            }
          })
        }
      >
        {busy ? (
          <ActivityIndicator color="#9b3525" />
        ) : (
          <Icon name="securityDeviceSignout" nativeSize={{ width: 20, height: 20 }} />
        )}
        <Text style={styles.revokeText}>Sign out device</Text>
      </Pressable>
    ) : undefined;
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
          accessibilityLabel={a.ui("Signed-in devices")}
          onPress={() => {
            open("phones");
            void phones.reload();
          }}
          style={styles.row}
        >
          {settingIcon("settingsDevices")}
          {heading(
            "Signed-in devices",
            phones.loading || (!phones.data && !phones.error)
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
      <AppSheet
        visible={panel !== null}
        title={panelTitle}
        onClose={() => open(null)}
        busy={busy}
        footer={footer}
        contentKey={panel || undefined}
        testID="security-sheet"
        subtitle={
          panel === "phones"
            ? "Review where your account is signed in"
            : panel === "revoke"
              ? "Confirm before removing account access"
              : "Confirm changes with your current PIN"
        }
      >
        {panel === "phones" ? (
          <>
            <View style={styles.devicesSummary}>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={styles.rowTitle}>
                  {phones.loading
                    ? a.ui("Checking…")
                    : phones.error || !phones.data
                      ? a.ui("Device list unavailable")
                      : a.ui(
                          phones.data.items.length === 1
                            ? "1 signed-in device"
                            : "{count} signed-in devices",
                          { count: phones.data.items.length },
                        )}
                </Text>
                <Text style={styles.activityText}>
                  Devices stay listed until they sign out or their sign-in expires.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={a.ui("Refresh devices")}
                accessibilityState={{ disabled: phones.loading || busy, busy: phones.loading }}
                disabled={phones.loading || busy}
                onPress={() => void phones.reload()}
                style={styles.refreshAction}
              >
                {phones.loading ? (
                  <ActivityIndicator color={colors.green} />
                ) : (
                  <Icon name="settingsChangePin" nativeSize={{ width: 22, height: 22 }} />
                )}
              </Pressable>
            </View>
            {!phones.loading && !phones.error && phones.data?.items.length === 0 && (
              <Notice text="No active devices found." />
            )}
            {!phones.loading &&
              !phones.error &&
              [...(phones.data?.items || [])]
                .sort((left, right) => Number(right.current) - Number(left.current))
                .map((device) => deviceCard(device, true))}
            <Text style={styles.activityText}>
              Activity shows the last recorded account use. Older devices may not have a saved name.
            </Text>
          </>
        ) : panel === "revoke" && selectedDevice ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={a.ui("Back to devices")}
              disabled={busy}
              onPress={() => open("phones")}
              style={styles.backToDevices}
            >
              <Icon name="settingsBack" nativeSize={{ width: 22, height: 22 }} />
              <Text style={styles.currentBadgeText}>Back to devices</Text>
            </Pressable>
            {deviceCard(selectedDevice, false)}
            <Label>
              This device will need to sign in again. Your current device will stay signed in.
            </Label>
            <Field
              label="Current PIN"
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              editable={!busy}
            />
          </>
        ) : (
          <>
            <View style={styles.sheetIntro}>
              {settingIcon(panel === "pin" ? "settingsChangePin" : "settingsBiometric")}
              <Text style={[styles.body, { flex: 1 }]}>
                {panel === "pin"
                  ? "Choose a new 4-digit PIN for your account."
                  : "Use your PIN to confirm this biometric preference."}
              </Text>
            </View>
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
              </>
            ) : (
              <Label muted>You can still use your PIN.</Label>
            )}
          </>
        )}
        {!!error && <Notice text={error} error />}
        {panel === "phones" && !!phones.error && <Notice text={phones.error} error />}
      </AppSheet>
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
  deviceCard: {
    padding: 16,
    gap: 12,
    borderRadius: 18,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.line,
  },
  currentDevice: { backgroundColor: "#f0f7f2", borderColor: "#c9dfd0" },
  deviceHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2f0ec",
  },
  deviceName: { fontFamily: "NotoBold", fontSize: 17, lineHeight: 24, color: colors.ink },
  devicePlatform: { fontFamily: "Noto", fontSize: 14, lineHeight: 20, color: colors.muted },
  deviceActivity: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  activityText: {
    fontFamily: "Noto",
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    flexShrink: 1,
  },
  currentBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#dceee2",
  },
  currentBadgeText: { fontFamily: "NotoBold", fontSize: 13, lineHeight: 20, color: colors.green },
  iconAction: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#fff4ef",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  devicesSummary: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 4 },
  sheetIntro: { flexDirection: "row", alignItems: "center", gap: 14 },
  backToDevices: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    minHeight: 44,
    alignSelf: "flex-start",
  },
  revokeAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#fff4ef",
    borderWidth: 1,
    borderColor: "#f2c9bc",
  },
  revokeText: { fontFamily: "NotoBold", fontSize: 16, color: "#9b3525" },
});
