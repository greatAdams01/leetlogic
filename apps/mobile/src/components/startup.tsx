import React from "react";
import { View, Image, Text, StyleSheet } from "react-native";
/** Uses bundled raster branding, so startup never waits for fonts or SVG parsing. */
export function Startup() {
  return (
    <View testID="brand-startup" accessibilityLabel="LeetLogic" style={styles.page}>
      <View style={styles.brand}>
        <Image
          source={require("../../assets/brand-logo.png")}
          style={styles.logo}
          accessibilityLabel="LeetLogic"
        />
        <Text style={styles.name}>LeetLogic</Text>
      </View>
      <View style={styles.band} />
    </View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#faf7f0", alignItems: "center", justifyContent: "center" },
  brand: { alignItems: "center", gap: 16 },
  logo: { width: 112, height: 112, resizeMode: "contain" },
  name: { fontSize: 32, fontWeight: "600", color: "#14532d", letterSpacing: 0.5 },
  band: {
    height: 80,
    backgroundColor: "#14532d",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
});
