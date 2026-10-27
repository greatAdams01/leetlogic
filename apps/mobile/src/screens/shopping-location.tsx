import React from "react";
import { BuyerLocation, useBuyerLocation } from "../components/buyer-location";
import { Button, Label, Page } from "../components/ui";
import { useApp } from "../state";
export function ShoppingLocation() {
  const a = useApp();
  const { ready, busy } = useBuyerLocation();
  return (
    <Page title="Shopping location" back={a.back}
      footer={<Button title="Done" disabled={!ready || busy} onPress={a.back} />}>
      <BuyerLocation />
      <Label muted>Your shopping location updates automatically. Tap Done to return.</Label>
    </Page>
  );
}
