import { LocalizedText as Text, useUI } from "../localization";
import React from "react";
import {
  View,
  Pressable,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { icons } from "../icons";
export const colors = {
  paper: "#faf7f0",
  green: "#14532d",
  action: "#2e9e4f",
  ink: "#1c1c1c",
  muted: "#66736b",
  line: "#e2ddd5",
  mint: "#e5f1e9",
  white: "#fff",
  gold: "#e3a008",
};
export function Icon({
  name,
  size = 22,
  nativeSize,
}: {
  name: keyof typeof icons;
  size?: number;
  nativeSize?: { width: number; height: number };
}) {
  const [xml, setXml] = React.useState<string | null>(null);
  React.useEffect(() => {
    let active = true;
    Asset.fromModule(icons[name])
      .downloadAsync()
      .then(async (a) => {
        const source = await new File(a.localUri || a.uri).text();
        if (active) setXml(source);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [name]);
  if (nativeSize)
    return (
      <View style={{ ...nativeSize, alignItems: "center", justifyContent: "center" }}>
        {xml && <SvgXml xml={xml} />}
      </View>
    );
  return xml ? (
    <SvgXml xml={xml} width={name === "wordmark" ? size * 5.068 : size} height={size} />
  ) : (
    <View style={{ width: size, height: size }} />
  );
}
export function Label({
  children,
  muted = false,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: any;
}) {
  return <Text style={[s.text, muted && { color: colors.muted }, style]}>{children}</Text>;
}
export function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={s.heading}>
      {children}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  disabled,
  secondary,
  testID,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  testID?: string;
  loading?: boolean;
}) {
  const tr = useUI();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={tr(title)}
      accessibilityState={{ disabled: !!disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: colors.green }]}>{title}</Text>
      {loading ? (
        <ActivityIndicator color={secondary ? colors.green : colors.white} />
      ) : (
        !secondary && <Icon name="arrow" size={20} />
      )}
    </Pressable>
  );
}
export function Field({
  label,
  hideLabel = false,
  ...props
}: TextInputProps & { label: string; hideLabel?: boolean }) {
  const tr = useUI();
  return (
    <View style={{ gap: 8 }}>
      {!hideLabel && <Text style={s.fieldLabel}>{label}</Text>}
      <TextInput
        placeholderTextColor="#96948d"
        {...props}
        placeholder={props.placeholder ? tr(props.placeholder) : undefined}
        accessibilityLabel={tr(props.accessibilityLabel || label)}
        style={[s.input, props.multiline && { height: 100, textAlignVertical: "top" }, props.style]}
      />
    </View>
  );
}
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Notice({
  text,
  error = false,
  success = false,
}: {
  text: string;
  error?: boolean;
  success?: boolean;
}) {
  const tint = error ? "#9b3525" : colors.green;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        s.notice,
        {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
          borderWidth: 1,
          borderColor: error ? "#f2c9bc" : "#c9dfd0",
          backgroundColor: error ? "#fff4ef" : "#f0f7f2",
        },
      ]}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: tint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "white", fontFamily: "NotoBold", fontSize: 14 }}>
          {error ? "!" : success ? "✓" : "i"}
        </Text>
      </View>
      <Label style={{ flex: 1, color: tint, fontSize: 14, lineHeight: 22 }}>{text}</Label>
    </View>
  );
}
export function Page({
  children,
  title,
  back,
  footer,
  green = false,
  loading = false,
  brand = false,
  backgroundColor = colors.paper,
}: {
  children: React.ReactNode;
  title?: string;
  back?: () => void;
  footer?: React.ReactNode;
  green?: boolean;
  loading?: boolean;
  brand?: boolean;
  backgroundColor?: string;
}) {
  const tr = useUI();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: green ? colors.green : backgroundColor }}
      edges={["top", "left", "right"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {title && (
          <View style={[s.header, green && { backgroundColor: colors.green }]}>
            {back && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tr("Go back")}
                onPress={back}
                hitSlop={16}
              >
                <Icon name={green ? "backLight" : "back"} />
              </Pressable>
            )}
            {brand ? (
              <View style={[s.between, { flex: 1 }]}>
                <View style={s.row}>
                  <Icon name="logo" size={32} />
                  <Icon name="wordmark" size={24} />
                </View>
                <Text style={[s.badge, { backgroundColor: colors.gold, color: "#000" }]}>
                  LANGUAGE
                </Text>
              </View>
            ) : (
              <Text accessibilityRole="header" style={[s.headerTitle, green && { color: "white" }]}>
                {title}
              </Text>
            )}
          </View>
        )}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.body, brand && { gap: 16 }]}
        >
          {loading && <ActivityIndicator color={colors.green} />}
          {children}
        </ScrollView>
        {footer && (
          <SafeAreaView edges={["bottom"]} style={[s.footer, { backgroundColor }]}>
            {footer}
          </SafeAreaView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export const s = StyleSheet.create({
  text: { fontFamily: "Noto", fontSize: 16, lineHeight: 24, color: colors.ink },
  heading: { fontFamily: "Montserrat", fontSize: 27, lineHeight: 35, color: colors.ink },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 24,
  },
  headerTitle: { fontFamily: "NotoBold", fontSize: 18, color: colors.ink, flex: 1 },
  body: { padding: 24, gap: 20, flexGrow: 1, paddingBottom: 28 },
  footer: { paddingHorizontal: 24, paddingTop: 12, gap: 12, backgroundColor: colors.paper },
  button: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.action,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
  },
  secondary: { backgroundColor: "#f0efeb" },
  buttonText: {
    fontFamily: "NotoBold",
    fontSize: 17,
    color: "white",
    textAlign: "center",
    flexShrink: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    minHeight: 54,
    fontFamily: "Noto",
    fontSize: 16,
    color: colors.ink,
  },
  fieldLabel: { fontFamily: "NotoBold", fontSize: 14, color: colors.ink },
  card: { backgroundColor: "white", borderRadius: 18, padding: 16, gap: 12 },
  notice: { backgroundColor: colors.mint, padding: 16, borderRadius: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  badge: {
    fontFamily: "NotoBold",
    fontSize: 12,
    color: colors.green,
    backgroundColor: colors.mint,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
  link: { fontFamily: "NotoBold", fontSize: 15, color: colors.green },
  choice: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 17,
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  selected: { borderWidth: 2, borderColor: colors.green, backgroundColor: "#f4f9f6" },
  small: { fontSize: 13, lineHeight: 20 },
  sectionTitle: { fontFamily: "Montserrat", fontSize: 20, lineHeight: 28, color: colors.ink },
});
