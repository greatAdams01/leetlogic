import React, { useState } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";
import { AppSheet } from "./app-sheet";
import { LocalizedText as Text, useUI } from "../localization";
import { colors, Icon, s } from "./ui";

export function Select({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: readonly (string | { value: string; label: string })[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const tr = useUI();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const close = () => {
    setOpen(false);
    setSearch("");
  };
  const records = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
  const selectedLabel = records.find((option) => option.value === value)?.label || value;
  const filtered = records.filter((option) =>
    tr(option.label).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={tr(label)}
        accessibilityValue={{ text: value ? tr(selectedLabel) : tr("Choose an option") }}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          s.input,
          { flexDirection: "row", alignItems: "center", gap: 12 },
          disabled && { opacity: 0.5 },
        ]}
      >
        <Text style={[s.text, { flex: 1, color: value ? colors.ink : colors.muted }]}>
          {selectedLabel || (disabled ? "Select a state first" : "Choose an option")}
        </Text>
        <View style={{ transform: [{ rotate: "90deg" }] }}>
          <Icon name="chevron" size={18} />
        </View>
      </Pressable>
      <AppSheet visible={open} title={label} onClose={close} scroll={false}>
        <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 16, gap: 16 }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={tr("Search options")}
            accessibilityLabel={tr("Search options")}
            autoCorrect={false}
            style={s.input}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={s.text}>No matching options</Text>}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: item.value === value }}
                onPress={() => {
                  onChange(item.value);
                  close();
                }}
                style={[s.choice, { marginBottom: 8 }, item.value === value && s.selected]}
              >
                <Text style={s.text}>{item.label}</Text>
              </Pressable>
            )}
          />
        </View>
      </AppSheet>
    </View>
  );
}
