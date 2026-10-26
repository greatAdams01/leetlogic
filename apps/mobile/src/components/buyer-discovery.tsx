import React from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useApp } from "../state";
import { ListingPhoto } from "./listing-photo";
import { Icon, Label, colors } from "./ui";
import { money, type Listing } from "../lib/domain";
export type BuyerCategory = {
  id: string;
  slug: string;
  translations: { locale: string; name: string }[];
  listingCount?: number;
  cover?: Pick<Listing, "title" | "media"> | null;
};
export function categoryTitle(item: BuyerCategory, locale: string) {
  return (
    item.translations.find((t) => t.locale === locale)?.name ||
    item.translations.find((t) => t.locale === "en")?.name ||
    item.slug
  );
}
export function CategoryTiles({
  items,
  selected,
  onChoose,
  compact = false,
  chips = false,
}: {
  items: BuyerCategory[];
  selected?: string;
  onChoose: (id: string) => void;
  compact?: boolean;
  chips?: boolean;
}) {
  const a = useApp();
  const width = (useWindowDimensions().width - 64) / 2;
  if (chips)
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {[
          { id: "", slug: "", translations: [{ locale: a.locale, name: a.ui("Show all") }] },
          ...items,
        ].map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === item.id }}
            accessibilityLabel={categoryTitle(item, a.locale)}
            onPress={() => onChoose(item.id)}
            style={{
              minHeight: 42,
              borderRadius: 24,
              paddingHorizontal: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: selected === item.id ? colors.green : colors.paper,
              borderWidth: 1,
              borderColor: selected === item.id ? colors.green : colors.line,
            }}
          >
            <Label style={{ color: selected === item.id ? "white" : colors.ink, fontSize: 14 }}>
              {categoryTitle(item, a.locale)}
            </Label>
            {selected === item.id && (
              <Icon name="buyerSelectedDot" nativeSize={{ width: 7, height: 7 }} />
            )}
          </Pressable>
        ))}
      </ScrollView>
    );
  const entries = items.map((item) => (
    <Pressable
      key={item.id}
      accessibilityRole="button"
      accessibilityLabel={categoryTitle(item, a.locale)}
      accessibilityState={{ selected: selected === item.id }}
      onPress={() => onChoose(item.id)}
      style={
        compact
          ? { width: 82, alignItems: "center", gap: 8 }
          : { width, backgroundColor: "white", borderRadius: 16, overflow: "hidden" }
      }
    >
      <View
        style={{
          width: compact ? 64 : width,
          height: compact ? 64 : width,
          borderRadius: compact ? 32 : 0,
          overflow: "hidden",
          backgroundColor: colors.mint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {item.cover?.media.length ? (
          <ListingPhoto item={item.cover as Listing} height={compact ? 64 : width} radius={0} />
        ) : (
          <Icon name="leaf" nativeSize={{ width: 36, height: 36 }} />
        )}
      </View>
      <View style={compact ? { gap: 4, alignItems: "center" } : { padding: 14, gap: 8 }}>
        <Label
          numberOfLines={compact ? 2 : undefined}
          style={{
            fontFamily: "NotoBold",
            fontSize: compact ? 13 : 16,
            textAlign: compact ? "center" : "left",
            color: selected === item.id ? colors.action : colors.ink,
          }}
        >
          {categoryTitle(item, a.locale)}
        </Label>
        {!compact && (
          <View style={{ padding: 8, borderRadius: 8, backgroundColor: "#f2f0ed", gap: 4 }}>
            <Label muted style={{ fontSize: 13 }}>
              Active listings
            </Label>
            <Label style={{ color: colors.green, fontFamily: "NotoBold" }}>
              {item.listingCount === undefined ? a.ui("Browse produce") : String(item.listingCount)}
            </Label>
          </View>
        )}
      </View>
    </Pressable>
  ));
  return compact ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 18, paddingVertical: 2 }}
    >
      {entries}
    </ScrollView>
  ) : (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>{entries}</View>
  );
}
export function ProduceGrid({ items, compact = false }: { items: Listing[]; compact?: boolean }) {
  const a = useApp();
  const width = (useWindowDimensions().width - 60) / 2;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={a.ui("View {title}", { title: item.title })}
          onPress={() => a.go("product", item.id)}
          style={{
            width: compact ? width : "100%",
            backgroundColor: "white",
            borderRadius: 16,
            overflow: "hidden",
            padding: compact ? 10 : 0,
            gap: 10,
          }}
        >
          <ListingPhoto item={item} height={compact ? 178 : 220} radius={compact ? 10 : 16} />
          <View style={{ padding: compact ? 0 : 16, gap: 10 }}>
            <Label style={{ fontFamily: "Montserrat", fontSize: compact ? 18 : 20 }}>
              {item.title}
            </Label>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
              <Label style={{ fontSize: 13 }}>
                {item.farmerProfile.farmName} · {item.locationAddress.city}
              </Label>
              <Icon name="buyerVerified" nativeSize={{ width: 14, height: 14 }} />
            </View>
            <View
              style={{
                flexDirection: "row",
                gap: 4,
                alignItems: "center",
                backgroundColor: colors.mint,
                padding: 7,
                borderRadius: 16,
              }}
            >
              <Icon name="buyerTruck" nativeSize={{ width: 14, height: 14 }} />
              <Label style={{ color: colors.green, fontSize: 12, flex: 1 }}>
                {item.shippingScope === "LOCAL" ? "Local delivery" : "Nigeria delivery"}
              </Label>
            </View>
            {item.distanceKm !== undefined && (
              <Label muted style={{ fontSize: 12 }}>
                {a.ui("About {distance} km away", { distance: item.distanceKm })}
              </Label>
            )}
            <View
              style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, gap: 4 }}
            >
              <Label style={{ color: "#6b4a2f", fontSize: 20, fontFamily: "NotoBold" }}>
                {money(item.unitPriceMinor)}
                <Label muted style={{ fontSize: 12 }}>{` / ${a.unit(item.unitCode)}`}</Label>
              </Label>
              <Label muted style={{ fontSize: 12 }}>
                {a.ui("{quantity} {unit} available", {
                  quantity: Math.max(
                    0,
                    Number(item.availableQuantity) - Number(item.reservedQuantity),
                  ),
                  unit: a.unit(item.unitCode),
                })}
              </Label>
            </View>
            <View
              style={{
                backgroundColor: colors.green,
                minHeight: 44,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                padding: 8,
              }}
            >
              <Label style={{ color: "white", fontFamily: "NotoBold", fontSize: 14 }}>
                View produce
              </Label>
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
