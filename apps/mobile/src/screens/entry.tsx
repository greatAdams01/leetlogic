import { LocalizedText as Text } from "../localization";
import React, { useState, useEffect } from "react";
import { View, Pressable, Image, ImageBackground, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useApp } from "../state";
import { Page, Heading, Label, Field, Button, Icon, Notice, s, colors } from "../components/ui";
import { api, deviceId, saveSession } from "../lib/api";
import { normalizeNigerianPhone } from "../../../../packages/contracts/src/phone";
import { type Locale } from "../../../../packages/localization/src/customer-messages";
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
  const a = useApp(),
    [step, setStep] = useState(() => {
      const index = Number(a.route.id || 0);
      return Number.isFinite(index) ? Math.max(0, Math.min(2, index)) : 0;
    });
  const next = async () => {
    if (step < 2) setStep(step + 1);
    else {
      await AsyncStorage.setItem("onboarded", "true");
      a.reset("role");
    }
  };
  return (
    <ImageBackground source={slides[step]!.image} style={{ flex: 1 }}>
      <LinearGradient
        colors={["#10231a33", "transparent", "#07180ee8", "#07180ef2"]}
        locations={[0, 0.4, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1, padding: 24, justifyContent: "space-between" }}>
        <View style={{ gap: 20 }}>
          <View style={[s.row, { gap: 8 }]}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={{
                  height: 4,
                  flex: 1,
                  backgroundColor: i === step ? colors.action : "#ffffff55",
                  borderRadius: 10,
                }}
              />
            ))}
          </View>
          <View style={s.between}>
            <Pressable
              accessibilityRole="button"
              onPress={() => (step ? setStep(step - 1) : a.back())}
            >
              <Label style={{ color: "white" }}>Prev.</Label>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                await AsyncStorage.setItem("onboarded", "true");
                a.reset("role");
              }}
            >
              <Label style={{ color: "white" }}>Skip</Label>
            </Pressable>
          </View>
          <Pressable
            testID="intro-change-language"
            accessibilityRole="button"
            accessibilityLabel={a.ui("Change language")}
            hitSlop={12}
            onPress={() => a.openLanguage(step)}
          >
            <Label style={{ color: "white", textDecorationLine: "underline" }}>
              Change language
            </Label>
          </Pressable>
        </View>
        <View style={{ gap: 20 }}>
          <View style={s.row}>
            <Icon name="logo" size={30} />
            <Icon name="wordmark" size={24} />
          </View>
          <Text style={{ fontFamily: "Montserrat", fontSize: 34, lineHeight: 42, color: "white" }}>
            {a.ui(slides[step]!.title)}
          </Text>
          <Label style={{ color: "#e0e4df" }}>{slides[step]!.body}</Label>
          <Button title={step === 2 ? "Explore Marketplace" : "Next"} onPress={() => void next()} />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}
export function Role() {
  const a = useApp();
  return (
    <Page
      title="CHOOSE YOUR ROLE"
      green
      footer={
        <>
          <Button
            title={a.role === "SELLER" ? "Continue as Seller/Farmer" : "Continue as Buyer"}
            onPress={() => a.go(a.user ? "home" : "phone")}
          />
          <Button title="Change language" secondary onPress={() => a.openLanguage()} />
        </>
      }
    >
      <Heading>Who are you?</Heading>
      <Label muted>Pick your role. You can sell harvest or purchase produce.</Label>
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
    </Page>
  );
}
export function Phone() {
  const a = useApp(),
    [phone, setPhone] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Page title="Verification" green back={a.back}>
      <Heading>Enter your phone number</Heading>
      <Label muted>We’ll send a 6-digit code to confirm your number.</Label>
      <Field
        label={a.t("auth.phone")}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        placeholder="08012345678"
        value={phone}
        onChangeText={setPhone}
      />
      <Label muted style={s.small}>
        Use 08012345678, 8012345678, or +2348012345678.
      </Label>
      {error && <Notice text={error} error />}
      <Button
        title={busy ? "Sending…" : a.t("common.continue")}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          setError("");
          try {
            const value = normalizeNigerianPhone(phone);
            await api("/auth/otp/request", {
              method: "POST",
              body: { phone: value, deviceId: await deviceId() },
            });
            a.go("otp", value);
          } catch (e) {
            setError(a.error(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </Page>
  );
}
export function Otp() {
  const a = useApp(),
    [code, setCode] = useState(""),
    [seconds, setSeconds] = useState(60),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const t = setInterval(() => setSeconds((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Page
      title="Verification"
      green
      back={a.back}
      footer={
        <Button
          title={busy ? "Verifying…" : a.t("common.continue")}
          disabled={busy || code.length !== 6}
          onPress={async () => {
            setBusy(true);
            setError("");
            try {
              const r = await api<any>("/auth/otp/verify", {
                method: "POST",
                body: { phone: a.route.id, deviceId: await deviceId(), code },
              });
              await saveSession(r);
              await a.loadUser();
              await a.changeLocale(a.locale);
              a.reset(a.role === "SELLER" ? "seller" : "home");
            } catch (e) {
              setError(a.error(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      }
    >
      <Heading>Enter your verification code</Heading>
      <Label muted>
        {a.ui("Sent to {phone} · Valid for 5 minutes", {
          phone: `•••••••${a.route.id?.slice(-3) || ""}`,
        })}
      </Label>
      <Field
        label={a.t("auth.code")}
        value={code}
        maxLength={6}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
        style={{
          fontSize: 28,
          letterSpacing: 16,
          textAlign: "center",
          height: 64,
          borderColor: colors.green,
          borderWidth: 2,
        }}
      />
      <Pressable
        accessibilityRole="button"
        disabled={!!seconds || busy}
        onPress={async () => {
          setBusy(true);
          try {
            await api("/auth/otp/request", {
              method: "POST",
              body: { phone: a.route.id, deviceId: await deviceId() },
            });
            setSeconds(60);
          } catch (e) {
            setError(a.error(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Label muted style={{ textAlign: "center" }}>
          {seconds
            ? a.ui("Resend code in {time}", { time: `0:${String(seconds).padStart(2, "0")}` })
            : a.ui("Resend code")}
        </Label>
      </Pressable>
      {error && <Notice text={error} error />}
    </Page>
  );
}
