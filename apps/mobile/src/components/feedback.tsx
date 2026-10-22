import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LocalizedText as Text, useUI } from "../localization";
import { colors } from "./ui";
export type FeedbackMessage = { id: number; text: string };
export function Feedback({
  message,
  dismiss,
}: {
  message: FeedbackMessage | null;
  dismiss: () => void;
}) {
  const inset = useSafeAreaInsets();
  const tr = useUI();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!message) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    });
    animation.start();
    AccessibilityInfo.announceForAccessibility(tr(message.text));
    const timer = setTimeout(() => {
      Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) dismiss();
        },
      );
    }, 5000);
    return () => {
      clearTimeout(timer);
      progress.stopAnimation();
    };
  }, [message]);
  if (!message) return null;
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          top: inset.top + 12,
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
          ],
        },
      ]}
    >
      <View style={styles.successMark}>
        <Text style={styles.check}>✓</Text>
      </View>
      <Text style={styles.message}>{message.text}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr("Dismiss notification")}
        onPress={dismiss}
        hitSlop={10}
        style={styles.dismiss}
      >
        <Text style={styles.close}>×</Text>
      </Pressable>
    </Animated.View>
  );
}
export function Confirmation({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onChange}
      style={[styles.confirm, checked && styles.confirmed, disabled && { opacity: 0.6 }]}
    >
      <View style={[styles.box, checked && styles.checked]}>
        {checked && <Text style={styles.tick}>✓</Text>}
      </View>
      <Text style={styles.confirmText}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 100,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.green,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#063017",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  successMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff24",
    alignItems: "center",
    justifyContent: "center",
  },
  check: { color: "white", fontSize: 19, fontWeight: "700" },
  message: { flex: 1, color: "white", fontFamily: "NotoBold", fontSize: 15, lineHeight: 22 },
  dismiss: { width: 30, height: 36, alignItems: "center", justifyContent: "center" },
  close: { color: "white", fontSize: 26 },
  confirm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.green,
    backgroundColor: "#f4f9f6",
  },
  confirmed: { backgroundColor: colors.mint },
  box: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.green,
    borderRadius: 6,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  checked: { backgroundColor: colors.green },
  tick: { color: "white", fontSize: 16, fontWeight: "700" },
  confirmText: {
    flex: 1,
    color: colors.green,
    fontFamily: "NotoBold",
    fontSize: 14,
    lineHeight: 21,
  },
});
