import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("react-native", () => ({
  View: "View",
  FlatList: "FlatList",
  Modal: "Modal",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  useWindowDimensions: () => ({ width: 400, height: 800 }),
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
}));
vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));
vi.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
vi.mock("../components/listing-photo", () => ({ ListingPhoto: "ListingPhoto" }));
vi.mock("../components/ui", () => ({ Label: "Label", Icon: "Icon", colors: {} }));
vi.mock("../state", () => ({
  useApp: () => ({
    ui: (s: string, params: Record<string, number> = {}) =>
      s.replace(/\{(\w+)\}/g, (_, key) => String(params[key])),
  }),
}));
import { ListingGallery } from "../components/listing-gallery";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
const keys = [
  "produce/11111111-1111-4111-8111-111111111111",
  "produce/22222222-2222-4222-8222-222222222222",
];
const item: any = {
  id: "listing",
  title: "Fresh produce",
  media: keys.map((objectKey) => ({ objectKey })),
};
afterEach(async () => {
  await act(async () => tree?.unmount());
});
it("includes every valid image and opens the tapped photo in a full-screen viewer", async () => {
  await act(async () => {
    tree = create(<ListingGallery item={item} />);
  });
  await act(async () =>
    tree.root
      .findAllByType("View" as any)
      .find((v) => v.props.onLayout)!
      .props.onLayout({ nativeEvent: { layout: { width: 360 } } }),
  );
  const hero = tree.root.findByType("FlatList" as any);
  expect(hero.props.data).toEqual(keys);
  expect(hero.props.pagingEnabled).toBe(true);
  const secondSlide = hero.props.renderItem({ item: keys[1], index: 1 });
  expect(secondSlide.props.children.props.objectKey).toBe(keys[1]);
  await act(async () => secondSlide.props.onPress());
  const modal = () => tree.root.findByType("Modal" as any);
  expect(modal().props.visible).toBe(true);
  expect(modal().props.presentationStyle).toBe("fullScreen");
  const viewer = tree.root.findAllByType("FlatList" as any)[1]!;
  expect(viewer.props.initialScrollIndex).toBe(1);
  const fullPhoto = viewer.props.renderItem({ item: keys[1] }).props.children;
  expect(fullPhoto.props.resizeMode).toBe("contain");
  expect(fullPhoto.props.height).toBe(517);
  expect(viewer.props.style).toMatchObject({ height: 517, flexGrow: 0, flexShrink: 0 });
  const safeContainer = tree.root
    .findAllByType("View" as any)
    .find((v) => v.props.style?.paddingTop === 67)!;
  expect(safeContainer.props.style.paddingBottom).toBe(42);
  expect(
    tree.root
      .findAllByType("View" as any)
      .some((v) => v.props.style?.height === 80 && v.props.style?.flexShrink === 0),
  ).toBe(true);
  expect(fullPhoto.props.objectKey).toBe(keys[1]);
  await act(async () => modal().props.onRequestClose());
  expect(modal().props.visible).toBe(false);
});
it("lets thumbnail taps change selection and leaves an unavailable-photo state for empty listings", async () => {
  await act(async () => {
    tree = create(<ListingGallery item={item} />);
  });
  const thumbnail = tree.root
    .findAllByType("Pressable" as any)
    .find((p) => p.props.accessibilityLabel === "Photo 2 of 2")!;
  await act(async () => thumbnail.props.onPress());
  expect(
    tree.root
      .findAllByType("Pressable" as any)
      .find((p) => p.props.accessibilityLabel === "Photo 2 of 2")!.props.accessibilityState
      .selected,
  ).toBe(true);
  await act(async () => tree.update(<ListingGallery item={{ ...item, media: [] }} />));
  expect(tree.root.findAllByType("Modal" as any)).toHaveLength(0);
  expect(tree.root.findByType("ListingPhoto" as any).props.item.media).toEqual([]);
});
