import React, { useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import type { SalePackaging } from "../../../../packages/contracts/src/sale-packaging";
import { packingFields, type PackingFields } from "./packaging";

vi.mock("../components/ui", () => ({ Card: "Card", Field: "Field", Heading: "Heading", Label: "Label" }));
vi.mock("../components/Select", () => ({ Select: "Select" }));
vi.mock("../components/feedback", () => ({ Confirmation: "Confirmation" }));
vi.mock("../state", () => ({ useApp: () => ({
  status: (text: string) => text,
  ui: (text: string, params: Record<string, unknown> = {}) => text.replace(/\{(\w+)\}/g, (_, key) => String(params[key])),
}) }));
import { PackingFieldsForm } from "../components/packing-fields";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
function Form({ sale, saved }: { sale: SalePackaging; saved?: PackingFields }) {
  const [value, setValue] = useState(saved || packingFields({ unitsPerPackage: 1 }));
  return <PackingFieldsForm value={value} onChange={setValue} salePackaging={sale} />;
}
const field = (label: string) => tree.root.findAllByType("Field" as any).find((node) => node.props.label === label);
const labels = () => tree.root.findAllByType("Label" as any).map((node) => node.props.children).join(" ");
const bag: SalePackaging = { type: "BAG", size: 50, measure: "KG" };
afterEach(async () => { await act(async () => tree?.unmount()); });

it("keeps intermediate decimal tare input while saving exact gross bag weight", async () => {
  await act(async () => { tree = create(<Form sale={bag} />); });
  const change = async (text: string) => act(async () => field("Additional packaging weight (kg) *")!.props.onChangeText(text));
  expect(labels()).toContain("Produce weight per parcel: 50 kg");
  expect(field("Packed weight (kg) *")).toBeUndefined();
  expect(field("Units in one package *")).toBeUndefined();
  for (const text of ["0", "0.", "0.5", "0.50", "0.500"] ) {
    await change(text);
    expect(field("Additional packaging weight (kg) *")!.props.value).toBe(text);
  }
  expect(labels()).toContain("Total packed weight: 50.5 kg");
  await change("0.5001");
  await change("-1");
  expect(field("Additional packaging weight (kg) *")!.props.value).toBe("0.500");
  await change("");
  expect(labels()).toContain("Total packed weight: — kg");
});

it("recalculates displayed tare when selling size or saved gross weight changes", async () => {
  const value = packingFields({ unitsPerPackage: 1, weightKg: 50.5 });
  const changed = vi.fn();
  await act(async () => { tree = create(<PackingFieldsForm value={value} salePackaging={bag} onChange={changed} />); });
  expect(field("Additional packaging weight (kg) *")!.props.value).toBe("0.5");
  await act(async () => tree.update(<PackingFieldsForm value={packingFields({ ...value, weightKg: "25.75" })} salePackaging={{ ...bag, size: 25 }} onChange={changed} />));
  expect(field("Additional packaging weight (kg) *")!.props.value).toBe("0.75");
  expect(labels()).toContain("Produce weight per parcel: 25 kg");
  await act(async () => tree.update(<PackingFieldsForm value={packingFields({ ...value, weightKg: "26" })} salePackaging={{ ...bag, size: 25 }} onChange={changed} />));
  expect(field("Additional packaging weight (kg) *")!.props.value).toBe("1");
  expect(changed).not.toHaveBeenCalled();
});

it.each([
  { type: "BOTTLE", size: 5, measure: "LITRE" },
  { type: "PIECE", size: 1, measure: "PIECE" },
] as SalePackaging[])("asks for actual gross weight for $measure instead of converting volume or pieces to kg", async (sale) => {
  await act(async () => { tree = create(<Form sale={sale} />); });
  expect(field("Additional packaging weight (kg) *")).toBeUndefined();
  expect(field("Packed weight (kg) *")).toBeDefined();
  expect(labels()).not.toContain("Produce weight per parcel:");
});
