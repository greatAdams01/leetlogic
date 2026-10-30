"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { editAmount, groupAmount } from "../../../packages/contracts/src/money";

export function MoneyInput({
  value,
  onChange,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | undefined>(undefined);
  const [focused, setFocused] = useState(false);
  const [selection, setSelection] = useState<number>();
  const display = groupAmount(
    !focused && /^\d+(\.\d{0,2})?$/.test(value)
      ? `${value.split(".")[0]}.${(value.split(".")[1] || "").padEnd(2, "0")}`
      : value,
  );
  useLayoutEffect(() => {
    if (focused && selection !== undefined) ref.current?.setSelectionRange(selection, selection);
  }, [display, selection, focused]);
  return (
    <input
      {...props}
      ref={ref}
      type="text"
      inputMode="decimal"
      value={display}
      onFocus={() => {
        setSelection(undefined);
        setFocused(true);
      }}
      onBlur={() => setFocused(false)}
      onSelect={(event) => {
        caret.current = event.currentTarget.selectionEnd ?? undefined;
      }}
      onBeforeInput={(event) => {
        caret.current = event.currentTarget.selectionEnd ?? undefined;
      }}
      onChange={(event) => {
        const edit = editAmount(
          value,
          event.target.value,
          caret.current,
          event.target.selectionStart ?? undefined,
        );
        if (!edit) return;
        onChange(edit.value);
        setSelection(edit.selection);
      }}
    />
  );
}
