import React, { useEffect, useRef, useState } from "react";
import { Card, Field, Heading, Label } from "./ui";
import { Select } from "./Select";
import { Confirmation } from "./feedback";
import {
  minimumPackedWeight,
  type SalePackaging,
} from "../../../../packages/contracts/src/sale-packaging";
import { type PackingFields } from "../lib/packaging";
import { useApp } from "../state";
export function PackingFieldsForm({
  value,
  onChange,
  salePackaging,
}: {
  value: PackingFields;
  salePackaging?: SalePackaging | null;
  onChange: (value: PackingFields) => void;
}) {
  const a = useApp();
  const nominal = minimumPackedWeight(
    salePackaging || undefined,
    Number(value.unitsPerPackage) || 1,
  );
  const packaged = salePackaging && !["KG", "TONNE", "LITRE", "PIECE"].includes(salePackaging.type);
  const tareFromWeight = () => value.weightKg && Number(value.weightKg) >= nominal
    ? String(Number((Number(value.weightKg) - nominal).toFixed(3))) : "";
  const [tare, setTare] = useState(tareFromWeight);
  const written = useRef({ nominal, weightKg: value.weightKg });
  useEffect(() => {
    if (written.current.nominal !== nominal || written.current.weightKg !== value.weightKg) {
      setTare(tareFromWeight());
      written.current = { nominal, weightKg: value.weightKg };
    }
  }, [nominal, value.weightKg]);

  return (
    <Card>
      <Heading>Packing and handling</Heading>
      <Label muted>Describe one fully packed box, bag or basket, including its packaging.</Label>
      {packaged && (
        <Label>
          {a.ui("Selling packages per parcel: {count}", { count: value.unitsPerPackage || "1" })}
        </Label>
      )}
      {nominal > 0 && (
        <>
          <Label>{a.ui("Produce weight per parcel: {weight} kg", { weight: nominal })}</Label>
          <Field
            label="Additional packaging weight (kg) *"
            keyboardType="decimal-pad"
            value={tare}
            onChangeText={(text) => {
              if (!/^\d*(\.\d{0,3})?$/.test(text)) return;
              setTare(text);
              const weightKg = text && Number.isFinite(Number(text))
                ? String(Number((nominal + Number(text)).toFixed(3))) : "";
              // Keep intermediate input such as "0." while the parent stores gross weight.
              written.current = { nominal, weightKg };
              onChange({ ...value, weightKg });
            }}
          />
          <Label muted>
            {a.ui("Total packed weight: {weight} kg", { weight: value.weightKg || "—" })}
          </Label>
        </>
      )}
      {(
        [
          ["unitsPerPackage", "Units in one package *"],
          ["weightKg", "Packed weight (kg) *"],
          ["length", "Package length (cm) *"],
          ["width", "Package width (cm) *"],
          ["height", "Package height (cm) *"],
        ] as const
      )
        .filter(
          ([key]) =>
            !(key === "weightKg" && nominal > 0) && !(key === "unitsPerPackage" && packaged),
        )
        .map(([key, label]) => (
          <Field
            key={key}
            label={label}
            value={value[key]}
            keyboardType="decimal-pad"
            onChangeText={(text) => onChange({ ...value, [key]: text })}
          />
        ))}
      <Label muted>
        Units means the selling unit you selected above. For example, 1 basket or 10 kilograms in
        one bag.
      </Label>
      <Select
        label="Required handling"
        value={value.handling}
        options={["STANDARD", "PERISHABLE", "COLD_CHAIN", "BULK"].map((code) => ({
          value: code,
          label: a.status(code),
        }))}
        onChange={(handling) =>
          onChange({ ...value, handling: handling as PackingFields["handling"] })
        }
      />
      <Label muted>
        For example: fragile, keep upright, keep refrigerated, or protect from direct sunlight.
      </Label>
      {(
        [
          ["FRAGILE", "Fragile produce"],
          ["VENTILATED", "Needs ventilation"],
          ["UPRIGHT", "Keep upright"],
          ["SHADE", "Protect from sunlight"],
          ["NON_STACKABLE", "Do not stack"],
        ] as const
      )
        .filter(
          ([flag]) =>
            value.specialHandling?.includes(flag) ||
            (salePackaging?.measure === "LITRE"
              ? ["UPRIGHT", "SHADE"].includes(flag)
              : ["BAG", "SACK", "KG", "TONNE"].includes(salePackaging?.type || "")
                ? ["SHADE", "NON_STACKABLE"].includes(flag)
                : flag !== "UPRIGHT"),
        )
        .map(([flag, label]) => (
          <Confirmation
            key={flag}
            label={label}
            checked={!!value.specialHandling?.includes(flag)}
            onChange={() =>
              onChange({
                ...value,
                specialHandling: value.specialHandling?.includes(flag)
                  ? value.specialHandling.filter((item) => item !== flag)
                  : [...(value.specialHandling || []), flag],
              })
            }
          />
        ))}
      <Field
        label="Pickup instructions (optional)"
        value={value.pickupInstructions || ""}
        maxLength={500}
        multiline
        onChangeText={(pickupInstructions) => onChange({ ...value, pickupInstructions })}
      />
      <Field
        label="Handling instructions"
        value={value.notes}
        maxLength={500}
        multiline
        onChangeText={(notes) => onChange({ ...value, notes })}
      />
    </Card>
  );
}
