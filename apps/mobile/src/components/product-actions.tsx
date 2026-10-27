import React, { useState } from "react";
import { Linking, Pressable, Share, View } from "react-native";
import { useApp } from "../state";
import { API_URL } from "../lib/api";
import { productShareUrl, whatsappShareUrl } from "../lib/product-share";
import { money, type Listing } from "../lib/domain";
import { AppSheet } from "./app-sheet";
import { Button, Icon, Label, Notice, colors } from "./ui";
export function ProductActions({
  item,
  liked,
  busy,
  onLike,
}: {
  item: Listing;
  liked: boolean;
  busy: boolean;
  onLike: () => void;
}) {
  const a = useApp(),
    [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const message = () => {
    const base =
      process.env.EXPO_PUBLIC_WEB_URL ||
      (__DEV__ ? API_URL.replace(/:3000$/, ":3001") : "https://leetlogicglobal.netlify.app");
    return `${item.title}\n${money(item.unitPriceMinor)} / ${a.unit(item.unitCode)}\n${item.farmerProfile.farmName}\n${productShareUrl(base, item.id)}`;
  };
  const share = async (whatsapp: boolean) => {
    setError("");
    try {
      if (whatsapp) await Linking.openURL(whatsappShareUrl(message()));
      else await Share.share({ message: message() });
      setOpen(false);
    } catch {
      setError(a.ui("We couldn’t open sharing. Please try again."));
    }
  };
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={a.ui("Share produce")}
          onPress={() => {
            setError("");
            setOpen(true);
          }}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="productShare" nativeSize={{ width: 22, height: 22 }} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={a.ui(liked ? "Unlike produce" : "Like produce")}
          accessibilityState={{ selected: liked, disabled: busy, busy }}
          disabled={busy}
          onPress={onLike}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: liked ? colors.mint : "transparent",
            alignItems: "center",
            justifyContent: "center",
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Icon name="productHeart" nativeSize={{ width: 22, height: 22 }} />
        </Pressable>
      </View>
      <AppSheet visible={open} title="Share produce" onClose={() => setOpen(false)}>
        <Label>{item.title}</Label>
        {error && <Notice text={error} error />}
        <Button title="Share to WhatsApp" onPress={() => void share(true)} />
        <Button title="More sharing options" secondary onPress={() => void share(false)} />
      </AppSheet>
    </>
  );
}
