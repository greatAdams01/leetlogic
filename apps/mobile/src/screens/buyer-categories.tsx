import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { useApp, useResource } from "../state";
import { Page, Field, Icon, Label, Notice, Button } from "../components/ui";
import { CategoryTiles, categoryTitle, type BuyerCategory } from "../components/buyer-discovery";
export function BuyerCategories() {
  const a = useApp();
  const r = useResource<{ items: BuyerCategory[] }>("/marketplace/categories");
  const [search, setSearch] = useState("");
  const items = (r.data?.items || []).filter((item) =>
    categoryTitle(item, a.locale).toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <Page
      loading={r.loading}
      contentStyle={{ paddingTop: 16 }}
      header={
        <View
          style={{
            height: 61,
            paddingHorizontal: 24,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a.ui("Go back")}
            onPress={a.back}
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="back" nativeSize={{ width: 24, height: 24 }} />
          </Pressable>
          <Label style={{ flex: 1, textAlign: "center", fontFamily: "Montserrat", fontSize: 20 }}>
            Categories
          </Label>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a.ui("Change shopping location")}
            onPress={() => a.go("shoppingLocation")}
            style={{ padding: 10 }}
          >
            <Icon name="buyerFilter" nativeSize={{ width: 24, height: 24 }} />
          </Pressable>
        </View>
      }
    >
      <Field
        label="Search categories"
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
      />
      <Label muted>Browse categories from verified farms across Nigeria.</Label>
      {!!r.error && (
        <>
          <Notice text={r.error} error />
          <Button title="Try again" secondary onPress={() => void r.reload()} />
        </>
      )}
      {!r.loading && !r.error && !items.length && (
        <Notice text="No categories match your search." />
      )}
      <CategoryTiles items={items} onChoose={(id) => a.go("search", id)} />
    </Page>
  );
}
