import React from "react";
import { BuyerLocation } from "../components/buyer-location";
import { Page } from "../components/ui";
import { useApp } from "../state";
export function ShoppingLocation() {
  const a = useApp();
  return (
    <Page title="Shopping location" back={a.back}>
      <BuyerLocation />
    </Page>
  );
}
