import React, { useState } from "react";
import { View } from "react-native";
import { Field, Label, Notice } from "./ui";
import { Select } from "./Select";
import { MoneyField } from "./money-field";
import { useApp } from "../state";
import { emptyPacking } from "../lib/packaging";
import type { ListingForm, ListingUnit } from "../lib/listing-form";
import {
  packagingOptions,
  packageUnitCode,
  saleUnitLabel,
  type SalePackaging,
} from "../../../../packages/contracts/src/sale-packaging";

export function SalePackagingForm({
  form,
  categorySlug,
  units,
  onChange,
}: {
  form: ListingForm;
  categorySlug: string;
  units: ListingUnit[];
  onChange: (value: ListingForm) => void;
}) {
  const a = useApp();
  const options = packagingOptions(categorySlug, form.title).filter(
    (option) => option.value === "CUSTOM" || packageUnitCode(option, units),
  );
  const selected = form.salePackaging;
  const [customAmount, setCustomAmount] = useState(
    selected?.size && selected.size > 0 ? String(selected.size) : "",
  );
  const option = options.find((item) => item.value === selected?.type);
  const size = selected?.size || 0;
  const [customSize, setCustomSize] = useState(!!size && !option?.sizes.includes(size));
  const unitLabel = selected && selected.size > 0 ? saleUnitLabel(selected, a.ui) : a.ui("Package");
  const update = (salePackaging: SalePackaging, unitCode = form.unitCode) => {
    const sameBasis =
      !form.salePackaging &&
      form.unitCode === unitCode &&
      ["KG", "TONNE", "LITRE", "PIECE"].includes(salePackaging.type);
    // Price and stock refer to one selling unit: changing it requires a fresh confirmation.
    onChange({
      ...form,
      salePackaging,
      unitCode,
      price: sameBasis ? form.price : "",
      quantity: sameBasis ? form.quantity : "",
      packaging: sameBasis
        ? form.packaging
        : {
            ...emptyPacking,
            handling: form.packaging?.handling || "STANDARD",
            unitsPerPackage: "1",
          },
    });
  };
  return (
    <View style={{ gap: 16 }}>
      <Label muted>
        Choose how buyers will purchase this produce. Sizes are suggestions; use your actual package
        size.
      </Label>
      <Select
        label="Packaging type *"
        value={selected?.type || ""}
        options={options.map(({ value, label }) => ({ value, label }))}
        onChange={(type) => {
          const choice = options.find((item) => item.value === type)!;
          if (selected?.type === type) return;
          setCustomAmount("");
          setCustomSize(false);
          update(
            {
              type: choice.value,
              size: choice.sizes.length === 1 ? choice.sizes[0]! : 0,
              measure: choice.measure,
            },
            packageUnitCode(choice, units) || "",
          );
        }}
      />
      {selected?.type === "CUSTOM" && (
        <>
          <Field
            label="Describe your package *"
            value={selected.customLabel || ""}
            maxLength={80}
            onChangeText={(customLabel) => update({ ...selected, customLabel })}
          />
          <Select
            label="Package measurement *"
            value={selected.measure}
            options={[
              { value: "KG", label: "Kilograms" },
              { value: "LITRE", label: "Litres" },
              { value: "PIECE", label: "Pieces" },
            ]}
            onChange={(measure) => {
              setCustomAmount("");
              update({ ...selected, size: 0, measure: measure as SalePackaging["measure"] });
            }}
          />
        </>
      )}
      {selected && option && option.sizes.length !== 1 && (
        <>
          {selected.type !== "CUSTOM" && (
            <Select
              label={selected.measure === "PIECE" ? "Pieces in each package *" : "Package size *"}
              value={size ? (customSize ? "CUSTOM" : String(size)) : ""}
              options={[
                ...option.sizes.map((amount) => ({
                  value: String(amount),
                  label: `${amount} ${selected.measure === "KG" ? "kg" : selected.measure === "LITRE" ? "L" : "pieces"}`,
                })),
                { value: "CUSTOM", label: "Other / Custom size" },
              ]}
              onChange={(amount) => {
                setCustomAmount("");
                setCustomSize(amount === "CUSTOM");
                update({ ...selected, size: amount === "CUSTOM" ? -1 : Number(amount) });
              }}
            />
          )}
          {(selected.type === "CUSTOM" || customSize) && (
            <Field
              label="Size of one selling package *"
              value={customAmount}
              keyboardType="decimal-pad"
              onChangeText={(text) => {
                if (/^\d*(\.\d{0,3})?$/.test(text)) {
                  setCustomAmount(text);
                  update({ ...selected, size: Number(text) || -1 });
                }
              }}
            />
          )}
        </>
      )}
      {selected &&
        selected.size > 0 &&
        (selected.type !== "CUSTOM" || selected.customLabel?.trim()) && (
          <>
            <Label>{a.ui("One selling unit: {unit}", { unit: unitLabel })}</Label>
            <Field
              label={a.ui("Available quantity ({unit}) *", { unit: unitLabel })}
              value={form.quantity}
              keyboardType="decimal-pad"
              onChangeText={(quantity) => onChange({ ...form, quantity })}
            />
            <Label muted>
              Enter how many selling units buyers can order, not the combined weight of your stock.
            </Label>
            <MoneyField
              label={a.ui("Price per {unit} · NGN *", { unit: unitLabel })}
              value={form.price}
              onChangeText={(price) => onChange({ ...form, price })}
            />
          </>
        )}
      {options.length === 1 && (
        <Notice text="Choose Other / Custom to describe how this produce is sold." />
      )}
    </View>
  );
}
