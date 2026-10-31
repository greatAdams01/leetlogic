import { LocalizedText as Text } from "../localization";
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Pressable,
  Image,
  ImageBackground,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Animated,
  PanResponder,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useApp } from "../state";
import { Page, Heading, Label, Field, Button, Icon, Notice, s, colors } from "../components/ui";
import { type Locale } from "../../../../packages/localization/src/customer-messages";
import { isIntroBackGesture, completesIntroBack } from "../lib/intro-gestures";
const languages: { locale: Locale; name: string; sub: string; code: string }[] = [
  { locale: "en", name: "English", sub: "English (Nigeria & Global)", code: "EN" },
  { locale: "pcm", name: "Naijá Pidgin", sub: "Nigerian Pidgin", code: "PG" },
  { locale: "ig", name: "Asụsụ Igbo", sub: "Igbo", code: "IG" },
  { locale: "ha", name: "Harshen Hausa", sub: "Hausa", code: "HA" },
  { locale: "yo", name: "Èdè Yorùbá", sub: "Yoruba", code: "YO" },
];
export function Language() {
  const a = useApp();
  const [selected, setSelected] = useState(a.locale),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Page
      title="LANGUAGE"
      back={a.canGoBack ? a.back : undefined}
      brand
      green
      footer={
        <>
          <Label muted style={{ fontSize: 13, textAlign: "center" }}>
            You can change this later in settings.
          </Label>
          <Button
            title={a.t("common.continue")}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await a.changeLocale(selected);
                a.finishLanguage();
              } catch (e) {
                setError(a.error(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      }
    >
      <View style={{ gap: 4 }}>
        <Heading>Choose your language</Heading>
        <Label muted>Select how you want to read and use the app.</Label>
      </View>
      <Field
        label="Search language"
        hideLabel
        style={{ borderRadius: 999 }}
        placeholder="Search language..."
        value={search}
        onChangeText={setSearch}
      />
      <View style={{ gap: 12 }}>
        {languages
          .filter((l) =>
            (l.name + l.sub + a.ui(l.name) + a.ui(l.sub))
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((l) => (
            <Pressable
              key={l.locale}
              accessibilityRole="radio"
              accessibilityLabel={l.name}
              accessibilityState={{ selected: selected === l.locale }}
              onPress={() => {
                setSelected(l.locale);
                void a.changeLocale(l.locale).catch((e) => setError(a.error(e)));
              }}
              style={[s.choice, selected === l.locale && s.selected]}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: selected === l.locale ? "#dceae2" : "#f5f5f4",
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={[s.link, { fontSize: 18 }]}>{l.code}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Label style={{ fontFamily: "NotoBold", fontSize: 18 }}>{l.name}</Label>
                <Label muted style={s.small}>
                  {l.sub}
                </Label>
              </View>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: selected === l.locale ? colors.green : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  name={selected === l.locale ? "check" : "circle"}
                  size={selected === l.locale ? 17 : 28}
                />
              </View>
            </Pressable>
          ))}
      </View>
      {error && <Notice text={error} error />}
    </Page>
  );
}
const slides = [
  {
    image: require("../../assets/figma/c10d6.png"),
    title: "Buy Fresh\nProduce",
    body: "Find farm produce from verified local farmers.",
  },
  {
    image: require("../../assets/figma/83e51.png"),
    title: "Sell Your\nProduce",
    body: "Create listings and reach more buyers.",
  },
  {
    image: require("../../assets/figma/3f910.png"),
    title: "Order with\nConfidence",
    body: "Follow your order and delivery from one place.",
  },
];
export function Intro() {
  const a = useApp();
  const { width } = useWindowDimensions();
  const pager = useRef<ScrollView>(null);
  const [step, setStep] = useState(() => {
    const index = Number(a.route.id || 0);
    return Number.isFinite(index) ? Math.max(0, Math.min(2, index)) : 0;
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const initialStep = useRef(step).current;
  const scrollX = useRef(new Animated.Value(initialStep * width)).current;
  const backDrag = useRef(new Animated.Value(0)).current;
  const scrollOffset = useRef(initialStep * width);
  const gestureStart = useRef(initialStep * width);
  const leaving = useRef(false);
  const [indicatorWidth, setIndicatorWidth] = useState(Math.max(0, width - 48));
  const segmentWidth = Math.max(0, (indicatorWidth - 16) / slides.length);
  const goToLanguage = () => a.openLanguage(0);
  const backGesture = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => {
          gestureStart.current = scrollOffset.current;
          return false;
        },
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          !leaving.current &&
          isIntroBackGesture(
            gestureStart.current,
            gesture.dx,
            gesture.dy,
            gesture.numberActiveTouches,
          ),
        onPanResponderMove: (_event, gesture) =>
          backDrag.setValue(Math.max(0, Math.min(width, gesture.dx))),
        onPanResponderRelease: (_event, gesture) => {
          if (completesIntroBack(gesture.dx, gesture.vx, width)) {
            leaving.current = true;
            Animated.timing(backDrag, {
              toValue: width,
              duration: 160,
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (finished) goToLanguage();
            });
          } else
            Animated.spring(backDrag, {
              toValue: 0,
              tension: 90,
              friction: 14,
              useNativeDriver: true,
            }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(backDrag, { toValue: 0, useNativeDriver: true }).start(),
        onPanResponderTerminationRequest: () => false,
      }),
    [width, a.openLanguage, backDrag],
  );
  // Restore the owning slide after a language change and retain it on rotation.
  useEffect(() => {
    scrollOffset.current = step * width;
    scrollX.setValue(step * width);
    pager.current?.scrollTo({ x: step * width, animated: false });
  }, [width]);
  const finish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await AsyncStorage.setItem("onboarded", "true");
      a.reset("role");
    } catch (e) {
      setError(a.error(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Animated.View
      {...backGesture.panHandlers}
      style={{ flex: 1, transform: [{ translateX: backDrag }] }}
    >
      <Animated.ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        contentOffset={{ x: initialStep * width, y: 0 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: true,
          listener: (event) => {
            scrollOffset.current = (
              event as import("react-native").NativeSyntheticEvent<
                import("react-native").NativeScrollEvent
              >
            ).nativeEvent.contentOffset.x;
          },
        })}
        onMomentumScrollEnd={(event) =>
          setStep(
            Math.max(
              0,
              Math.min(slides.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)),
            ),
          )
        }
        accessibilityActions={[
          { name: "increment", label: a.ui("Next slide") },
          { name: "decrement", label: a.ui("Previous slide") },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "decrement" && step === 0) {
            goToLanguage();
            return;
          }
          const next = Math.max(
            0,
            Math.min(
              slides.length - 1,
              step + (event.nativeEvent.actionName === "increment" ? 1 : -1),
            ),
          );
          pager.current?.scrollTo({ x: next * width, animated: true });
          setStep(next);
        }}
      >
        {slides.map((slide, index) => (
          <ImageBackground key={slide.title} source={slide.image} style={{ width, flex: 1 }}>
            <LinearGradient
              colors={["#10231a33", "transparent", "#07180ee8", "#07180ef2"]}
              locations={[0, 0.4, 0.7, 1]}
              style={StyleSheet.absoluteFill}
            />
            <SafeAreaView style={{ flex: 1, padding: 24, justifyContent: "flex-end" }}>
              <View style={{ gap: 20 }}>
                <View style={s.row}>
                  <Icon name="logo" size={30} />
                  <Icon name="wordmark" size={24} />
                </View>
                <Text
                  style={{ fontFamily: "Montserrat", fontSize: 34, lineHeight: 42, color: "white" }}
                >
                  {a.ui(slide.title)}
                </Text>
                <Label style={{ color: "#e0e4df" }}>{slide.body}</Label>
                {index === slides.length - 1 && (
                  <Button title="Explor LeetLogic" disabled={busy} onPress={() => void finish()} />
                )}
                {error && index === step && <Notice text={error} error />}
              </View>
            </SafeAreaView>
          </ImageBackground>
        ))}
      </Animated.ScrollView>
      <SafeAreaView pointerEvents="box-none" style={[StyleSheet.absoluteFill, { padding: 24 }]}>
        <View style={{ gap: 20 }}>
          <View
            pointerEvents="none"
            onLayout={(event) => setIndicatorWidth(event.nativeEvent.layout.width)}
            style={{ flexDirection: "row", gap: 8, height: 4 }}
          >
            {slides.map((_, i) => (
              <View
                key={i}
                style={{ flex: 1, height: 4, backgroundColor: "#ffffff55", borderRadius: 10 }}
              />
            ))}
            <Animated.View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: segmentWidth,
                height: 4,
                borderRadius: 10,
                backgroundColor: colors.action,
                transform: [
                  {
                    translateX: scrollX.interpolate({
                      inputRange: [0, width * (slides.length - 1)],
                      outputRange: [0, (segmentWidth + 8) * (slides.length - 1)],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              }}
            />
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void finish()}>
              <Label style={{ color: "white" }}>Skip</Label>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}
export function Role() {
  const a = useApp();
  const [creating, setCreating] = useState(false);
  return (
    <Page
      title="WELCOME TO LEETLOGIC"
      green
      footer={
        <>
          <Button title="Log In" onPress={a.startLogin} />
          {!creating && <Button title="Create Account" onPress={() => setCreating(true)} />}
          {creating && <Button
            title={a.role === "SELLER" ? "Create Seller Account" : "Create Buyer Account"}
            onPress={() => void a.selectRole(a.role)}
          />}
          <Button title="Change language" secondary onPress={() => a.openLanguage()} />
        </>
      }
    >
      {creating && <>
      <Heading>Create Account</Heading>
      <Label muted>New here? Choose Buyer or Seller to create your account.</Label>
      {(["SELLER", "BUYER"] as const).map((r) => (
        <Pressable
          key={r}
          accessibilityRole="radio"
          accessibilityState={{ selected: a.role === r }}
          onPress={() => a.setRole(r)}
          style={[
            {
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 16,
              overflow: "hidden",
              backgroundColor: "white",
            },
            a.role === r && { borderWidth: 2, borderColor: colors.green },
          ]}
        >
          <Image
            source={
              r === "SELLER"
                ? require("../../assets/figma/cb68b.png")
                : require("../../assets/figma/cd1b3.png")
            }
            style={{ width: "100%", height: 176 }}
          />
          <View style={{ padding: 16, gap: 8 }}>
            <View style={s.between}>
              <Label style={{ fontFamily: "NotoBold", fontSize: 20 }}>
                {r === "SELLER" ? "I want to sell" : "I want to buy"}
              </Label>
              <Icon name={a.role === r ? "check" : "circle"} />
            </View>
            <Label muted style={s.small}>
              {r === "SELLER"
                ? "List harvest with a photo, set your price in ₦."
                : "Source directly from verified farmers at local rates."}
            </Label>
          </View>
        </Pressable>
      ))}
      </>}
    </Page>
  );
}
export { Phone, Otp } from "./verification-entry";
