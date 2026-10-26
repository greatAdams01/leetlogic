import React, { useRef, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { ListingPhoto } from "./listing-photo";
import { Icon, Label, colors } from "./ui";
import { useApp } from "../state";
import type { Listing } from "../lib/domain";

export function ListingGallery({ item }: { item: Listing }) {
  const a = useApp();
  const photos = [
    ...new Set(
      item.media?.map((m) => m.objectKey).filter((key) => /^produce\/[a-f0-9-]{36}$/i.test(key)) ||
        [],
    ),
  ];
  const [selected, setSelected] = useState(0);
  const [opened, setOpened] = useState(false);
  const [width, setWidth] = useState(0);
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Reserve the header, thumbnail strip and system bars before sizing the photo.
  const viewerHeight = Math.max(
    1,
    Math.min(
      520,
      window.height - insets.top - insets.bottom - 80 - (photos.length > 1 ? 86 : 0) - 24,
    ),
  );
  const hero = useRef<FlatList<string>>(null);
  const viewer = useRef<FlatList<string>>(null);
  const count = (index: number) =>
    a.ui("Photo {index} of {total}", { index: index + 1, total: photos.length });
  const choose = (index: number) => {
    setSelected(index);
    hero.current?.scrollToOffset({ offset: index * width, animated: true });
    if (opened) viewer.current?.scrollToOffset({ offset: index * window.width, animated: true });
  };
  const close = () => {
    setOpened(false);
    hero.current?.scrollToOffset({ offset: selected * width, animated: false });
  };
  const thumbnails = (dark = false) =>
    photos.length > 1 && (
      <ScrollView
        horizontal
        style={{ flexGrow: 0, flexShrink: 0, height: 86 }}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingHorizontal: dark ? 16 : 2, paddingVertical: 2 }}
      >
        {photos.map((key, index) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={count(index)}
            accessibilityState={{ selected: selected === index }}
            onPress={() => choose(index)}
            style={{
              width: 70,
              padding: 3,
              borderRadius: 17,
              borderWidth: 2,
              borderColor: selected === index ? (dark ? "#8cde9d" : colors.action) : "transparent",
              opacity: selected === index ? 1 : 0.65,
            }}
          >
            <ListingPhoto item={item} objectKey={key} height={60} />
          </Pressable>
        ))}
      </ScrollView>
    );
  if (!photos.length) return <ListingPhoto item={item} height={290} />;
  return (
    <View style={{ gap: 10 }}>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ borderRadius: 22, overflow: "hidden", backgroundColor: colors.mint }}
      >
        {width > 0 && (
          <FlatList
            ref={hero}
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialNumToRender={1}
            windowSize={3}
            keyExtractor={(key) => key}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            onMomentumScrollEnd={(event) =>
              setSelected(
                Math.max(
                  0,
                  Math.min(
                    photos.length - 1,
                    Math.round(event.nativeEvent.contentOffset.x / width),
                  ),
                ),
              )
            }
            renderItem={({ item: key, index }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={a.ui("Open photo {index}", { index: index + 1 })}
                onPress={() => {
                  setSelected(index);
                  setOpened(true);
                }}
                style={{ width }}
              >
                <ListingPhoto item={item} objectKey={key} height={Math.min(360, width * 0.95)} />
              </Pressable>
            )}
          />
        )}
        <LinearGradient
          pointerEvents="none"
          colors={["transparent", "#00000099"]}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 100 }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 18,
            left: 18,
            right: 18,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Label style={{ color: "white", fontSize: 13 }}>Tap to view full photo</Label>
          <View
            style={{
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: "#00000066",
            }}
          >
            <Label
              style={{ color: "white", fontSize: 12 }}
            >{`${selected + 1} / ${photos.length}`}</Label>
          </View>
        </View>
      </View>
      {thumbnails()}
      <Modal
        visible={opened}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={close}
      >
        {opened && (
          <View
            style={{
              flex: 1,
              backgroundColor: "#101a14",
              paddingTop: insets.top + 8,
              paddingBottom: insets.bottom + 8,
            }}
          >
            <StatusBar style="light" />
            <View
              style={{
                height: 80,
                flexShrink: 0,
                paddingHorizontal: 20,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 16,
              }}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Label numberOfLines={1} style={{ color: "white", fontFamily: "NotoBold" }}>
                  {item.title}
                </Label>
                <Label style={{ color: "#c3cec7", fontSize: 13 }}>{count(selected)}</Label>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={a.ui("Close photos")}
                onPress={close}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "white",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="listingReviewClose" nativeSize={{ width: 20.87, height: 20.87 }} />
              </Pressable>
            </View>
            <View style={{ flex: 1, minHeight: 0, justifyContent: "center" }}>
              {viewerHeight > 0 && (
                <FlatList
                  key={window.width}
                  style={{ height: viewerHeight, flexGrow: 0, flexShrink: 0 }}
                  ref={viewer}
                  data={photos}
                  horizontal
                  pagingEnabled
                  initialScrollIndex={selected}
                  initialNumToRender={1}
                  windowSize={3}
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(key) => key}
                  getItemLayout={(_, index) => ({
                    length: window.width,
                    offset: window.width * index,
                    index,
                  })}
                  onMomentumScrollEnd={(event) =>
                    setSelected(
                      Math.max(
                        0,
                        Math.min(
                          photos.length - 1,
                          Math.round(event.nativeEvent.contentOffset.x / window.width),
                        ),
                      ),
                    )
                  }
                  renderItem={({ item: key }) => (
                    <View
                      style={{
                        width: window.width,
                        height: viewerHeight,
                        justifyContent: "center",
                      }}
                    >
                      <ListingPhoto
                        item={item}
                        objectKey={key}
                        height={viewerHeight}
                        resizeMode="contain"
                      />
                    </View>
                  )}
                />
              )}
            </View>
            {thumbnails(true)}
          </View>
        )}
      </Modal>
    </View>
  );
}
