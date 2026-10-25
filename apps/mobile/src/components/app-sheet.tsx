import React, { useEffect } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LocalizedText as Text, useUI } from "../localization";
import { colors, Heading, Label } from "./ui";

/** Shared modal shell: fixed header/footer, safe areas, keyboard-aware forms, and an unscrolled map/list body. */
export function AppSheet({
  visible,
  title,
  subtitle,
  onClose,
  busy = false,
  footer,
  children,
  scroll = true,
  contentKey,
  testID = "app-sheet",
  closeLabel = "Close dialog",
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  busy?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  contentKey?: string;
  testID?: string;
  closeLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  const tr = useUI();
  useEffect(() => {
    if (visible) Keyboard.dismiss();
  }, [visible]);
  const close = () => {
    if (!busy) {
      Keyboard.dismiss();
      onClose();
    }
  };
  if (!visible) return null;
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
      testID={testID}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.overlay, { paddingTop: insets.top + 12 }]}
      >
        <Pressable
          testID={`${testID}-backdrop`}
          accessible={false}
          style={StyleSheet.absoluteFill}
          disabled={busy}
          onPress={close}
        />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <View style={{ flex: 1, gap: 4 }}>
              <Heading>{title}</Heading>
              {subtitle && <Label muted>{subtitle}</Label>}
            </View>
            <Pressable
              testID={`${testID}-close`}
              accessibilityRole="button"
              accessibilityLabel={tr(closeLabel)}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              hitSlop={8}
              onPress={close}
              style={styles.close}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          {scroll ? (
            <ScrollView
              key={contentKey}
              style={{ flex: 1 }}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {children}
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>{children}</View>
          )}
          {footer && <View style={styles.footer}>{footer}</View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    height: "90%",
    maxHeight: "100%",
    backgroundColor: colors.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  header: { flexDirection: "row", alignItems: "flex-start", padding: 20, gap: 12 },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  closeText: { fontSize: 30, lineHeight: 34, color: colors.ink },
  content: { padding: 20, gap: 16 },
  footer: { padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: colors.line },
});
