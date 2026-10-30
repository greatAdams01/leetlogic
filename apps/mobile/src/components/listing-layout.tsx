import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useApp } from "../state";
import { LocalizedText as Text } from "../localization";
import { colors, Icon, Page } from "./ui";
export function ListingPage({
  step,
  onBack,
  onClose,
  footer,
  loading,
  children,
  contentKey,
  complete = false,
  choosingMethod = false,
}: {
  step: 1 | 2 | 3 | 4;
  onBack?: () => void;
  onClose: () => void;
  footer: React.ReactNode;
  loading?: boolean;
  children: React.ReactNode;
  contentKey?: string;
  complete?: boolean;
  choosingMethod?: boolean;
}) {
  const a = useApp();
  return (
    <Page
      loading={loading}
      contentKey={contentKey}
      contentStyle={{
        paddingHorizontal: step === 2 || step === 3 ? 24 : 20,
        ...(step === 4 ? { gap: 12 } : {}),
      }}
      header={
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a.ui("Go back")}
            onPress={onBack}
            disabled={!onBack}
            style={styles.hit}
          >
            {onBack && (
              <Icon
                name={
                  step === 1
                    ? "listingBack"
                    : step === 2
                      ? "listingInfoBack"
                      : step === 4
                        ? "listingReviewBack"
                        : "back"
                }
                nativeSize={
                  step === 1
                    ? { width: 40, height: 40 }
                    : step === 2
                      ? { width: 24, height: 24 }
                      : step === 4
                        ? { width: 20.87, height: 20.87 }
                        : { width: 24, height: 24 }
                }
              />
            )}
          </Pressable>
          <View style={[styles.step, step === 4 && !complete && styles.reviewStep]}>
            {!complete && (
              <Text style={styles.stepText}>
                {a.ui("Step {step} of 5", { step: choosingMethod ? 1 : step + 1 })}
              </Text>
            )}
            {step === 4 && !complete && <Text style={styles.subtitle}>Review listing</Text>}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a.ui(complete ? "Close listing" : "Save and close listing")}
            onPress={onClose}
            style={styles.hit}
          >
            <Icon
              name={
                complete
                  ? "listingSuccessClose"
                  : step === 4
                    ? "listingReviewClose"
                    : "listingClose"
              }
              nativeSize={
                complete
                  ? { width: 20.8738, height: 20.8738 }
                  : step === 4
                    ? { width: 20.87, height: 20.87 }
                    : { width: 40, height: 40 }
              }
            />
          </Pressable>
        </View>
      }
      footer={footer}
    >
      {children}
    </Page>
  );
}
export function ListingProgress({ step, label }: { step: 1 | 2 | 3; label: string }) {
  const a = useApp();
  return (
    <View style={styles.progress}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexShrink: 1 }}>
        <Text style={styles.chip}>{a.ui("Step {step} of 5", { step: step + 1 })}</Text>
        <Text style={styles.subtitle}>{label}</Text>
      </View>
      <View style={styles.bars}>
        {[1, 2, 3, 4, 5].map((index) => (
          <View
            key={index}
            style={[styles.bar, index <= step + 1 && { backgroundColor: colors.green }]}
          />
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    minHeight: 60,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  hit: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reviewStep: {
    backgroundColor: "#e3faec",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#c4efd8",
  },
  stepText: {
    fontFamily: "NotoBold",
    fontSize: 12,
    color: colors.green,
    textTransform: "uppercase",
  },
  subtitle: { fontFamily: "Noto", fontSize: 14, color: "#3f4943", flexShrink: 1 },
  progress: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  chip: {
    fontFamily: "NotoBold",
    fontSize: 14,
    color: "#002114",
    backgroundColor: "#a5f3cc",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
  bars: { flexDirection: "row", gap: 6 },
  bar: { width: 28, height: 6, borderRadius: 8, backgroundColor: "#e5e2e1" },
});
