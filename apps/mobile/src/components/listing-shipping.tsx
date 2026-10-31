import React, { useState } from "react";
import { View } from "react-native";
import { Button, Notice } from "./ui";
import { PackingFieldsForm } from "./packing-fields";
import { packingFields, packingError, packingValue } from "../lib/packaging";
import { api } from "../lib/api";
import { useApp } from "../state";
import type { Listing } from "../lib/domain";
export function ListingShipping({
  item,
  onUpdated,
}: {
  item: Listing;
  onUpdated: () => Promise<unknown>;
}) {
  const a = useApp();
  const [open, setOpen] = useState(false),
    [value, setValue] = useState(packingFields(item.packaging || { unitsPerPackage: 1 }));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <View style={{ gap: 16 }}>
      <Button
        title="Edit shipping details"
        secondary
        disabled={busy}
        onPress={() => {
          setValue(packingFields(item.packaging || { unitsPerPackage: 1 }));
          setError("");
          setOpen(!open);
        }}
      />
      {open && (
        <>
          <PackingFieldsForm value={value} salePackaging={item.salePackaging} onChange={setValue} />
          {error && <Notice text={error} error />}
          <Button
            title="Save shipping details"
            loading={busy}
            disabled={busy}
            onPress={async () => {
              const invalid = packingError(value);
              if (invalid) {
                setError(a.ui(invalid));
                return;
              }
              setBusy(true);
              setError("");
              try {
                await api(`/marketplace/my-listings/${item.id}/packaging`, {
                  method: "PATCH",
                  body: { packaging: packingValue(value) },
                });
                await onUpdated();
                setOpen(false);
              } catch (failure) {
                setError(a.error(failure));
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
    </View>
  );
}
