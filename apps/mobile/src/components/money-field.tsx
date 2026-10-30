import React, { useRef, useState } from "react";
import { Field } from "./ui";
import { editAmount, groupAmount } from "../../../../packages/contracts/src/money";

export function MoneyField({
  label,
  value,
  onChangeText,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number }>();
  const caret = useRef<number | undefined>(undefined);
  const display = groupAmount(
    !focused && /^\d+(\.\d{0,2})?$/.test(value)
      ? `${value.split(".")[0]}.${(value.split(".")[1] || "").padEnd(2, "0")}`
      : value,
  );
  return (
    <Field
      label={label}
      value={display}
      keyboardType="decimal-pad"
      editable={editable}
      selection={focused ? selection : undefined}
      onSelectionChange={(event) => {
        caret.current = event.nativeEvent.selection.end;
        setSelection(event.nativeEvent.selection);
      }}
      onFocus={() => {
        setSelection(undefined);
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
        setSelection(undefined);
      }}
      onChangeText={(text) => {
        const edit = editAmount(value, text, caret.current);
        if (!edit) return;
        onChangeText(edit.value);
        caret.current = edit.selection;
        setSelection({ start: edit.selection, end: edit.selection });
      }}
    />
  );
}
