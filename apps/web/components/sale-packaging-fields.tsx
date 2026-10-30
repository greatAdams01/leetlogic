"use client";
import { useState } from "react";
import {
  packagingOptions,
  packageUnitCode,
  saleUnitLabel,
  type SalePackaging,
} from "../../../packages/contracts/src/sale-packaging";
import { ui } from "../../mobile/src/lib/localization";
import { useLanguage } from "./language-provider";
import { MoneyInput } from "./money-input";

export function SalePackagingFields({
  category,
  title,
  units,
  value,
  unitCode,
  quantity,
  price,
  onChange,
  onQuantity,
  onPrice,
}: {
  category: string;
  title: string;
  units: { code: string }[];
  value?: SalePackaging;
  unitCode: string;
  quantity: string;
  price: string;
  onChange: (value: SalePackaging, unitCode: string) => void;
  onQuantity: (value: string) => void;
  onPrice: (value: string) => void;
}) {
  const { locale } = useLanguage();
  const say = (text: string, params = {}) => ui(locale, text, params);
  const [customSize, setCustomSize] = useState("");
  const options = packagingOptions(category, title).filter((option) =>
    packageUnitCode(option, units),
  );
  const selected = options.find((option) => option.value === value?.type);
  const [custom, setCustom] = useState(!!value?.size && !selected?.sizes.includes(value.size));
  const measure = value?.measure === "KG" ? "kg" : value?.measure === "LITRE" ? "L" : say("Pieces");
  const label = value && value.size > 0 ? saleUnitLabel(value, say) : say("Package");
  return (
    <>
      <p>
        {say(
          "Choose how buyers will purchase this produce. Sizes are suggestions; use your actual package size.",
        )}
      </p>
      <label>
        {say("Packaging type *")}
        <select
          required
          value={value?.type || ""}
          onChange={(event) => {
            const option = options.find((item) => item.value === event.target.value)!;
            setCustomSize("");
            setCustom(false);
            onChange(
              {
                type: option.value,
                size: option.sizes.length === 1 ? option.sizes[0]! : 0,
                measure: option.measure,
              },
              packageUnitCode(option, units)!,
            );
          }}
        >
          <option value="">{say("Choose an option")}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {say(option.label)}
            </option>
          ))}
        </select>
      </label>
      {value?.type === "CUSTOM" && (
        <>
          <label>
            {say("Describe your package *")}
            <input
              required
              maxLength={80}
              value={value.customLabel || ""}
              onChange={(event) =>
                onChange({ ...value, customLabel: event.target.value }, unitCode)
              }
            />
          </label>
          <label>
            {say("Package measurement *")}
            <select
              value={value.measure}
              onChange={(event) => {
                setCustomSize("");
                onChange(
                  { ...value, size: 0, measure: event.target.value as SalePackaging["measure"] },
                  unitCode,
                );
              }}
            >
              <option value="KG">{say("Kilograms")}</option>
              <option value="LITRE">{say("Litres")}</option>
              <option value="PIECE">{say("Pieces")}</option>
            </select>
          </label>
        </>
      )}
      {value && selected && selected.sizes.length !== 1 && (
        <>
          {value.type !== "CUSTOM" && (
            <label>
              {say(value.measure === "PIECE" ? "Pieces in each package *" : "Package size *")}
              <select
                required
                value={value.size ? (custom ? "CUSTOM" : String(value.size)) : ""}
                onChange={(event) => {
                  setCustomSize("");
                  setCustom(event.target.value === "CUSTOM");
                  onChange(
                    {
                      ...value,
                      size: event.target.value === "CUSTOM" ? -1 : Number(event.target.value),
                    },
                    unitCode,
                  );
                }}
              >
                <option value="">{say("Choose an option")}</option>
                {selected.sizes.map((size) => (
                  <option key={size} value={size}>
                    {size} {measure}
                  </option>
                ))}
                <option value="CUSTOM">{say("Other / Custom size")}</option>
              </select>
            </label>
          )}
          {(value.type === "CUSTOM" || (custom && value.size !== 0)) && (
            <label>
              {say("Size of one selling package *")} ({measure})
              <input
                required
                type="number"
                min="0.001"
                step={value.measure === "PIECE" ? "1" : "0.001"}
                value={customSize}
                onChange={(event) => {
                  setCustomSize(event.target.value);
                  onChange({ ...value, size: Number(event.target.value) || -1 }, unitCode);
                }}
              />
            </label>
          )}
        </>
      )}
      {value && value.size > 0 && (value.type !== "CUSTOM" || value.customLabel?.trim()) && (
        <>
          <p>{say("One selling unit: {unit}", { unit: label })}</p>
          <label>
            {say("Available quantity ({unit}) *", { unit: label })}
            <input
              name="quantity"
              required
              type="number"
              min="0.001"
              step={
                units.find((unit) => unit.code === unitCode) &&
                ["KG", "TONNE", "LITRE"].includes(unitCode)
                  ? "0.001"
                  : "1"
              }
              value={quantity}
              onChange={(event) => onQuantity(event.target.value)}
            />
          </label>
          <p>
            {say(
              "Enter how many selling units buyers can order, not the combined weight of your stock.",
            )}
          </p>
          <label>
            {say("Price per {unit} · NGN *", { unit: label })}
            <MoneyInput value={price} onChange={onPrice} required />
          </label>
        </>
      )}
    </>
  );
}
