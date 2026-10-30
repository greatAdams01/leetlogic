import React, { useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { emptyListing } from "./listing-form";
vi.mock("react-native", () => ({ View: "View" }));
vi.mock("../components/ui", () => ({ Field: "Field", Label: "Label", Notice: "Notice" }));
vi.mock("../components/Select", () => ({ Select: "Select" }));
vi.mock("../state", () => ({
  useApp: () => ({
    ui: (text: string, params: Record<string, string> = {}) =>
      text.replace(/\{(\w+)\}/g, (_, key) => params[key] || key),
    unit: (text: string) => text,
  }),
}));
import { SalePackagingForm } from "../components/sale-packaging";
import { MoneyField } from "../components/money-field";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
const select = (label: string) =>
  tree.root.findAllByType("Select" as never).find((node) => node.props.label === label)!;
const field = (label: string) =>
  tree.root.findAllByType("Field" as never).find((node) => node.props.label === label)!;

it("keeps Other / Custom size editable while its digits pass through suggested bag sizes", async () => {
  function Harness() {
    const [form, setForm] = useState({ ...emptyListing, title: "Rice" });
    return (
      <SalePackagingForm
        form={form}
        categorySlug="grains"
        units={[
          { code: "BAG", allowsDecimal: false },
          { code: "PIECE", allowsDecimal: false },
        ]}
        onChange={setForm}
      />
    );
  }
  await act(async () => {
    tree = create(<Harness />);
  });
  await act(async () => select("Packaging type *").props.onChange("BAG"));
  await act(async () => select("Package size *").props.onChange("CUSTOM"));
  for (const text of ["1", "10", "100", "1000"]) {
    await act(async () => field("Size of one selling package *").props.onChangeText(text));
    expect(field("Size of one selling package *").props.value).toBe(text);
    expect(select("Package size *").props.value).toBe("CUSTOM");
  }
});

it("retains a decimal separator and leading zero while entering a custom liquid size", async () => {
  function Harness() {
    const [form, setForm] = useState({ ...emptyListing, title: "Palm oil" });
    return (
      <SalePackagingForm
        form={form}
        categorySlug="oils"
        units={[{ code: "PIECE", allowsDecimal: false }]}
        onChange={setForm}
      />
    );
  }
  await act(async () => {
    tree = create(<Harness />);
  });
  await act(async () => select("Packaging type *").props.onChange("BOTTLE"));
  await act(async () => select("Package size *").props.onChange("CUSTOM"));
  for (const text of ["0", "0.", "0.5"]) {
    await act(async () => field("Size of one selling package *").props.onChangeText(text));
    expect(field("Size of one selling package *").props.value).toBe(text);
  }
});

it("shows grouped price input with a stable caret and commits only the raw decimal amount", async () => {
  let raw = "";
  function Harness() {
    const [value, setValue] = useState("150000");
    return (
      <MoneyField
        label="Price"
        value={value}
        onChangeText={(text) => {
          raw = text;
          setValue(text);
        }}
      />
    );
  }
  await act(async () => {
    tree = create(<Harness />);
  });
  expect(field("Price").props.value).toBe("150,000.00");
  await act(async () => field("Price").props.onFocus());
  await act(async () =>
    field("Price").props.onSelectionChange({ nativeEvent: { selection: { start: 2, end: 2 } } }),
  );
  await act(async () => field("Price").props.onChangeText("1520,000"));
  expect(raw).toBe("1520000");
  expect(field("Price").props.value).toBe("1,520,000");
  expect(field("Price").props.selection).toEqual({ start: 4, end: 4 });
});
