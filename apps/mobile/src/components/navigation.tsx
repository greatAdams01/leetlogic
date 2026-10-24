import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../state";
import { colors, Icon, Label } from "./ui";

const tabs = [
  { name: "home", label: "Home", icon: "home", active: "homeActive" },
  { name: "search", label: "Search", icon: "search", active: "searchActive" },
  { name: "orders", label: "Orders", icon: "orders", active: "ordersActive" },
  { name: "profile", label: "Menu", icon: "profile", active: "profileActive" },
] as const;

export function Navigation() {
  const a = useApp();
  const selected = tabs.findIndex((tab) => tab.name === a.route.name);
  const [width, setWidth] = useState(0);
  // Default to no motion until the device preference has been read.
  const [reduceMotion, setReduceMotion] = useState(true);
  const position = useRef(new Animated.Value(Math.max(selected, 0))).current;
  const fades = useRef(
    tabs.map((_, index) => new Animated.Value(index === selected ? 1 : 0)),
  ).current;
  const slot = width / tabs.length;
  const pillWidth = Math.max(0, Math.min(slot - 4, 112));

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduceMotion(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    position.stopAnimation();
    fades.forEach((value) => value.stopAnimation());
    if (reduceMotion) {
      position.setValue(Math.max(selected, 0));
      fades.forEach((value, index) => value.setValue(index === selected ? 1 : 0));
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(position, {
        toValue: Math.max(selected, 0),
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      ...fades.map((value, index) =>
        Animated.timing(value, {
          toValue: index === selected ? 1 : 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ),
    ]);
    animation.start();
    return () => animation.stop();
  }, [position, selected, reduceMotion, fades]);

  return (
    <SafeAreaView edges={["bottom"]} style={styles.surface}>
      <View style={styles.bar} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && selected >= 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pill,
              {
                width: pillWidth,
                left: (slot - pillWidth) / 2,
                transform: [{ translateX: Animated.multiply(position, slot) }],
              },
            ]}
          />
        )}
        {tabs.map((tab, index) => {
          const active = selected === index;
          return (
            <Pressable
              key={tab.name}
              accessibilityRole="tab"
              accessibilityLabel={a.ui(tab.label)}
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (!active) a.reset(tab.name);
              }}
              style={styles.tab}
            >
              <Animated.View
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  styles.activeContent,
                  { width: pillWidth || undefined, opacity: fades[index] },
                ]}
              >
                <Icon name={tab.active} size={16} />
                <Label numberOfLines={1} adjustsFontSizeToFit style={styles.activeLabel}>
                  {tab.label}
                </Label>
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  styles.inactiveContent,
                  {
                    opacity: fades[index]?.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                  },
                ]}
              >
                <Icon name={tab.icon} size={20} />
                <Label numberOfLines={1} adjustsFontSizeToFit style={styles.label}>
                  {tab.label}
                </Label>
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  surface: { backgroundColor: colors.white },
  bar: { marginHorizontal: 20, height: 64, flexDirection: "row", alignItems: "center" },
  tab: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center" },
  pill: {
    position: "absolute",
    height: 28,
    top: 18,
    borderRadius: 999,
    backgroundColor: colors.green,
  },
  activeContent: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  activeLabel: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "NotoBold",
    flexShrink: 1,
  },
  inactiveContent: { alignItems: "center", gap: 4 },
  label: { fontSize: 14, lineHeight: 20, color: "#78716c" },
});
