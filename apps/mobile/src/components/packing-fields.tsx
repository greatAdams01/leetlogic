import React from "react";
import { Card, Field, Heading, Label } from "./ui";
import { Select } from "./Select";
import { type PackingFields } from "../lib/packaging";
import { useApp } from "../state";
export function PackingFieldsForm({
  value,
  onChange,
}: {
  value: PackingFields;
  onChange: (value: PackingFields) => void;
}) {
  const a = useApp();
  return (
    <Card>
      <Heading>Packing and handling</Heading>
      <Label muted>Describe one fully packed box, bag or basket, including its packaging.</Label>
      {(
        [
          ["unitsPerPackage", "Units in one package *"],
          ["weightKg", "Packed weight (kg) *"],
          ["length", "Package length (cm) *"],
          ["width", "Package width (cm) *"],
          ["height", "Package height (cm) *"],
        ] as const
      ).map(([key, label]) => (
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
