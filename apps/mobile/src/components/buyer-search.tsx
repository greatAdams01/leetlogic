import React, { useRef, useState } from "react";
import { Keyboard, Pressable, View, type TextInput } from "react-native";
import { useApp } from "../state";
import { AppSheet } from "./app-sheet";
import { Field, Icon, Label, colors } from "./ui";
/** A modal owns text entry; the marketplace behind it cannot scroll or take taps. */
export function BuyerSearch({
  compact = false,
  value,
  onSearch,
}: {
  compact?: boolean;
  value: string;
  onSearch: (query: string) => void;
}) {
  const a = useApp();
  const input = useRef<TextInput>(null);
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(value);
  const close = () => {
    Keyboard.dismiss();
    setOpen(false);
  };
  const submit = () => {
    const query = draft.trim();
    close();
    onSearch(query);
  };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a.ui("Search produce")}
        onPress={() => {
          setDraft(value);
          setOpen(true);
        }}
        style={
          compact
            ? {
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 22,
                backgroundColor: "white",
              }
            : {
                height: 54,
                paddingHorizontal: 17,
                borderRadius: 9999,
                backgroundColor: "white",
                borderWidth: 1,
                borderColor: "#e7e5e4",
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }
        }
      >
        <Icon name="search" nativeSize={{ width: 20, height: 20 }} />
        {!compact && (
          <Label numberOfLines={1} style={{ color: "#a8a29e", flex: 1 }}>
            {value || a.ui("Search produce, farmer, state...")}
          </Label>
        )}
      </Pressable>
      <AppSheet
        visible={open}
        title="Search produce"
        onClose={close}
        onShow={() => input.current?.focus()}
        scroll={false}
      >
        <View style={{ padding: 20 }}>
          <View style={{ position: "relative" }}>
            <Field
              inputRef={input}
              label="Search produce"
              hideLabel
              autoFocus
              value={draft}
              onChangeText={setDraft}
              placeholder="Search produce, farmer, state..."
              returnKeyType="search"
              submitBehavior="blurAndSubmit"
              onSubmitEditing={submit}
              maxLength={100}
              style={{ backgroundColor: "white", borderRadius: 28, paddingRight: 60 }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={a.ui("Search")}
              onPress={submit}
              style={{
                position: "absolute",
                right: 6,
                top: 5,
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="search" nativeSize={{ width: 20, height: 20 }} />
            </Pressable>
          </View>
        </View>
      </AppSheet>
    </>
  );
}
