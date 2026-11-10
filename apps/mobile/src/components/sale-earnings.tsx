import React, { useState } from "react";
import { View } from "react-native";
import { commissionRate, estimateSale, type FarmerOrderEarnings, type FarmerSaleHistory } from "../../../../packages/contracts/src/sale-earnings";
import { money, toMinor } from "../lib/domain";
import { useApp, useResource } from "../state";
import { Button, Card, Heading, Label, Notice, s } from "./ui";

type Amounts = FarmerOrderEarnings;
export function SaleBreakdown({ amounts, netLabel, grossLabel = "Gross produce amount" }: {
  amounts: Pick<Amounts, "grossMinor" | "commissionMinor" | "netMinor"> & { basisPoints?: number };
  netLabel: string;
  grossLabel?: string;
}) {
  const a = useApp();
  const commissionLabel = a.ui("Leetlogic commission");
  return <>
    {[
      [a.ui(grossLabel), money(amounts.grossMinor)],
      [amounts.basisPoints === undefined ? commissionLabel : `${commissionLabel} (${commissionRate(amounts.basisPoints)})`, money(amounts.commissionMinor)],
      [a.ui(netLabel), money(amounts.netMinor)],
    ].map(([label, amount]) => <View key={label} style={[s.between, { gap: 12, flexWrap: "wrap" }]}>
      <Label>{label}</Label><Label style={{ fontFamily: "NotoBold" }}>{amount}</Label>
    </View>)}
  </>;
}

export function ListingCommission({ basisPoints, price }: { basisPoints?: number; price: string }) {
  const a = useApp();
  if (basisPoints === undefined) return <Notice text="The current commission rate is unavailable. Refresh before submitting your listing." />;
  let grossMinor = 0n;
  try { grossMinor = BigInt(toMinor(price)); } catch { /* Wait for a valid price. */ }
  return <>
    <Label>{a.ui("Current Leetlogic commission: {rate} of produce sales.", { rate: commissionRate(basisPoints) })}</Label>
    {grossMinor > 0n && <SaleBreakdown amounts={estimateSale(grossMinor, basisPoints)} grossLabel="Price per selling unit" netLabel="Estimated earnings per unit" />}
    <Label muted>Each order shows its own commission and expected earnings before you accept.</Label>
  </>;
}

export function OrderSaleEarnings({ amounts }: { amounts: Amounts }) {
  return <Card>
    <Heading>Your earnings from this order</Heading>
    {amounts.state === "NO_CREDIT" ? <Label>No sale earnings were credited.</Label> : <>
      <SaleBreakdown amounts={amounts} netLabel={amounts.state === "CREDITED" ? "Credited to you" : "Expected earnings"} />
      <Label muted>Buyer checkout fees and delivery are separate from produce earnings.</Label>
      <Label muted>Any bank withdrawal fee is shown separately before you withdraw.</Label>
    </>}
  </Card>;
}

export function SaleHistory() {
  const a = useApp();
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const sales = useResource<FarmerSaleHistory>(`/financial/sales${cursor ? `?cursor=${cursor}` : ""}`);
  return <Card>
    <Heading>Sale earnings history</Heading>
    {sales.error ? <><Notice text={sales.error} error /><Button title="Retry" secondary onPress={() => void sales.reload()} /></>
      : sales.loading ? <Label>Loading…</Label>
      : sales.data && <>
        {!sales.data.items.length && <Label>No credited sales yet.</Label>}
        {sales.data.items.map((sale) => <View key={sale.id} style={{ gap: 6, marginVertical: 8 }}>
          <Button title={`${sale.title} · ${sale.reference}`} secondary onPress={() => a.go("delivery", sale.orderId)} />
          <Label muted>{a.date(sale.createdAt)}</Label>
          <SaleBreakdown amounts={sale} netLabel="Credited to you" />
        </View>)}
        {cursors.length > 0 && <Button title="Newer sales" secondary onPress={() => setCursors(cursors.slice(0, -1))} />}
        {sales.data.nextCursor && <Button title="Older sales" secondary onPress={() => setCursors([...cursors, sales.data!.nextCursor!])} />}
      </>}
  </Card>;
}
