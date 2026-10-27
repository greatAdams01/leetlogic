import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LocalizedText as Text } from "../localization";
import { useApp, useResource } from "../state";
import { bottomTabs, tabGeometry } from "../lib/bottom-tabs";
import { sellerSummary } from "../lib/seller-dashboard";
import type { Order } from "../lib/domain";
import { colors, Icon, Label } from "./ui";

export function Navigation() {
  const a = useApp();
  const tabs = bottomTabs(a.role);
  const selected = Math.max(
    0,
    tabs.findIndex((tab) => tab.name === (a.route.name === "categories" ? "search" : a.route.name)),
  );
  const orders = useResource<{ items: Order[] }>(
    `/orders?view=${a.role === "SELLER" ? "seller" : "buyer"}`,
    !!a.user && a.role === "SELLER",
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void orders.reload();
    });
    return () => subscription.remove();
  }, [orders.reload]);
  const hasNewOrder =
    a.role === "SELLER" && !!orders.data && sellerSummary([], orders.data.items).toPack.length > 0;
  const [width, setWidth] = useState(0);
  const [labelWidths, setLabelWidths] = useState<Record<string, number>>({});
  const [reduceMotion, setReduceMotion] = useState(true);
  const labelWidth = labelWidths[a.ui(tabs[selected]!.label)] || 46;
  const geometry = useMemo(
    () => tabGeometry(width, tabs.length, selected, labelWidth),
    [width, tabs.length, selected, labelWidth],
  );
  const [coordinates] = useState(() =>
    tabs.map(() => ({
      left: new Animated.Value(0),
      opacity: new Animated.Value(0),
    })),
  );
  const [pill] = useState(() => ({ left: new Animated.Value(0), width: new Animated.Value(28) }));
  const laidOut = useRef(false);

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
    if (!width) return;
    const target = geometry[selected]!;
    const destinations: [Animated.Value, number][] = [
      [pill.left, target.left],
      [pill.width, target.width],
    ];
    coordinates.forEach((values, index) => {
      const item = geometry[index]!;
      destinations.push([values.left, item.left], [values.opacity, index === selected ? 1 : 0]);
    });
    if (reduceMotion || !laidOut.current) {
      destinations.forEach(([value, to]) => {
        value.stopAnimation();
        value.setValue(to);
      });
      laidOut.current = true;
      return;
    }
    // Animate transforms/opacity on the UI thread; never lay out every tab on every frame.
    const animation = Animated.parallel(
      destinations.map(([value, toValue]) =>
        Animated.timing(value, {
          toValue,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    );
    animation.start();
    return () => animation.stop();
  }, [geometry, selected, width, reduceMotion, coordinates, pill]);
  return (
    <SafeAreaView edges={["bottom"]} style={styles.surface}>
      <View style={styles.bar} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.measure}
        >
          {tabs.map((tab) => (
            <Text
              key={tab.name}
              style={styles.measureLabel}
              onLayout={(event) => {
                const label = a.ui(tab.label),
                  measured = Math.ceil(event.nativeEvent.layout.width);
                setLabelWidths((old) =>
                  old[label] === measured ? old : { ...old, [label]: measured },
                );
              }}
            >
              {tab.label}
            </Text>
          ))}
        </View>
        {width > 0 && (
          <View pointerEvents="none" style={styles.indicator}>
            <Animated.View style={[styles.pillCap, { transform: [{ translateX: pill.left }] }]} />
            <Animated.View
              style={[
                styles.pillBridge,
                {
                  transform: [
                    {
                      translateX: Animated.add(
                        pill.left,
                        Animated.subtract(Animated.divide(pill.width, 2), 0.5),
                      ),
                    },
                    { scaleX: Animated.subtract(pill.width, 28) },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.pillCap,
                {
                  transform: [
                    { translateX: Animated.add(pill.left, Animated.subtract(pill.width, 28)) },
                  ],
                },
              ]}
            />
          </View>
        )}
        {tabs.map((tab, index) => {
          const values = coordinates[index]!;
          const active = selected === index;
          return (
            <Animated.View
              key={tab.name}
              style={[
                styles.slot,
                { width: geometry[index]!.width, transform: [{ translateX: values.left }] },
              ]}
            >
              <Pressable
                accessibilityRole="tab"
                accessibilityLabel={a.ui(tab.label)}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  if (!active) {
                    if (a.user) a.reset(tab.name);
                    else a.go(tab.name);
                  }
                }}
                style={styles.tab}
              >
                <Animated.View
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[styles.activeContent, { opacity: values.opacity }]}
                >
                  <Icon
                    name={tab.active}
                    nativeSize={{
                      width:
                        tab.name === "sell" || tab.name === "orders" || tab.name === "cart"
                          ? 20
                          : 16,
                      height:
                        tab.name === "sell" || tab.name === "orders" || tab.name === "cart"
                          ? 20
                          : 16,
                    }}
                  />
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
                      opacity: values.opacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0],
                      }),
                    },
                  ]}
                >
                  <View>
                    <Icon name={tab.icon} nativeSize={{ width: 20, height: 20 }} />
                    {tab.name === "orders" && hasNewOrder && <View style={styles.dot} />}
                  </View>
                  <Label numberOfLines={1} adjustsFontSizeToFit style={styles.label}>
                    {tab.label}
                  </Label>
                </Animated.View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  surface: { backgroundColor: colors.white },
  bar: { marginHorizontal: 20, height: 64 },
  slot: { position: "absolute", left: 0, top: 8, height: 48 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center" },
  indicator: { position: "absolute", left: 0, top: 18, height: 28 },
  pillCap: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.green,
  },
  pillBridge: { position: "absolute", width: 1, height: 28, backgroundColor: colors.green },
  activeContent: {
    position: "absolute",
    width: "100%",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  activeLabel: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "NotoBold",
    flexShrink: 1,
  },
  inactiveContent: { width: "100%", alignItems: "center", gap: 4 },
  label: { fontSize: 14, lineHeight: 20, color: "#78716c" },
  dot: {
    position: "absolute",
    right: -6,
    top: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gold,
  },
  measure: { position: "absolute", opacity: 0, alignItems: "flex-start" },
  measureLabel: { fontSize: 14, fontFamily: "NotoBold" },
});
