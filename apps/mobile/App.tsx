import { Finance } from "./src/screens/finance";
import React, { useEffect, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import { Startup } from "./src/components/startup";
import { LocalizedText } from "./src/localization";
void SplashScreen.preventAutoHideAsync().catch(() => {});
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { AppProvider, useApp } from "./src/state";
import { Language, Intro, Role, Phone, Otp } from "./src/screens/entry";
import { Market, Product, Orders } from "./src/screens/market";
import { Delivery, Quotes } from "./src/screens/delivery";
import { Sell, Review, MyListings } from "./src/screens/sell";
import { Profile, Details, Addresses, Notifications, Help, Seller } from "./src/screens/account";
import { colors } from "./src/components/ui";
import { Navigation } from "./src/components/navigation";
import { SellerHome } from "./src/screens/seller-home";
import { showsBottomTabs } from "./src/lib/bottom-tabs";
function Router() {
  const a = useApp();
  if (!a.ready) return <Startup />;
  const screens = {
    language: Language,
    intro: Intro,
    role: Role,
    phone: Phone,
    otp: Otp,
    home: a.role === "SELLER" && a.user ? SellerHome : Market,
    search: Market,
    product: Product,
    orders: Orders,
    delivery: Delivery,
    quotes: Quotes,
    finance: Finance,
    profile: Profile,
    details: Details,
    addresses: Addresses,
    seller: Seller,
    sell: Sell,
    review: Review,
    myListings: MyListings,
    notifications: Notifications,
    help: Help,
  };
  const protectedScreens = [
    "orders",
    "delivery",
    "quotes",
    "finance",
    "profile",
    "details",
    "addresses",
    "seller",
    "sell",
    "review",
    "myListings",
    "notifications",
  ];
  const Screen = !a.user && protectedScreens.includes(a.route.name) ? Phone : screens[a.route.name];
  return (
    <>
      <StatusBar
        style={
          ["phone", "otp", "role", "language", "intro"].includes(a.route.name) ||
          (a.route.name === "home" && a.role === "SELLER" && !!a.user)
            ? "light"
            : "dark"
        }
      />
      <View style={{ flex: 1 }}>
        <Screen key={`${a.route.name}:${a.route.id || ""}`} />
      </View>
      {Screen !== Phone && showsBottomTabs(a.role, a.route.name, !!a.user) && (
        <Navigation key={a.role} />
      )}
    </>
  );
}
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <View
        style={{ flex: 1, padding: 30, justifyContent: "center", backgroundColor: colors.paper }}
      >
        <LocalizedText>
          LeetLogic could not display this screen. Restart the app and try again.
        </LocalizedText>
      </View>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const [brandShown, setBrandShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setBrandShown(true), 1200);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);
  const [loaded, error] = useFonts({
    Noto: require("../web/public/fonts/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyD9A99d.ttf"),
    NotoBold: require("../web/public/fonts/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyAjBN9d.ttf"),
    Montserrat: require("../web/public/fonts/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-.ttf"),
  });
  if ((!loaded && !error) || !brandShown) return <Startup />;
  return (
    <SafeAreaProvider>
      <AppProvider>
        <ErrorBoundary>
          <Router />
        </ErrorBoundary>
      </AppProvider>
    </SafeAreaProvider>
  );
}
