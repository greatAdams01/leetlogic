"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "../../../packages/contracts/src/money";
import { commissionRate, estimateSale, type FarmerOrderEarnings, type FarmerSaleHistory } from "../../../packages/contracts/src/sale-earnings";
import { ui, localizedError, dateLabel } from "../../mobile/src/lib/localization";
import { customerApi } from "../lib/customer-api";
import { useLanguage } from "./language-provider";

export function SaleBreakdown({ amounts, grossLabel = "Gross produce amount", netLabel }: {
  amounts: Pick<FarmerOrderEarnings, "grossMinor" | "commissionMinor" | "netMinor"> & { basisPoints?: number };
  grossLabel?: string;
  netLabel: string;
}) {
  const { locale } = useLanguage();
  return <dl className="sale-breakdown">
    <div><dt>{ui(locale, grossLabel)}</dt><dd>{formatMoney(amounts.grossMinor)}</dd></div>
    <div>
      <dt>{ui(locale, "Leetlogic commission")}{amounts.basisPoints === undefined ? "" : ` (${commissionRate(amounts.basisPoints)})`}</dt>
      <dd>{formatMoney(amounts.commissionMinor)}</dd>
    </div>
    <div><dt>{ui(locale, netLabel)}</dt><dd><strong>{formatMoney(amounts.netMinor)}</strong></dd></div>
  </dl>;
}

export function OrderSaleEarnings({ amounts }: { amounts: FarmerOrderEarnings }) {
  const { locale } = useLanguage();
  return <section className="journey-card">
    <h2>{ui(locale, "Your earnings from this order")}</h2>
    {amounts.state === "NO_CREDIT" ? <p>{ui(locale, "No sale earnings were credited.")}</p> : <>
      <SaleBreakdown amounts={amounts} netLabel={amounts.state === "CREDITED" ? "Credited to you" : "Expected earnings"} />
      <p>{ui(locale, "Buyer checkout fees and delivery are separate from produce earnings.")}</p>
      <p>{ui(locale, "Any bank withdrawal fee is shown separately before you withdraw.")}</p>
    </>}
  </section>;
}

export function ListingCommission({ basisPoints, unitPriceMinor }: { basisPoints?: number; unitPriceMinor?: string }) {
  const { locale } = useLanguage();
  if (basisPoints === undefined) return <p>{ui(locale, "The current commission rate is unavailable. Refresh before submitting your listing.")}</p>;
  return <>
    <p>{ui(locale, "Current Leetlogic commission: {rate} of produce sales.", { rate: commissionRate(basisPoints) })}</p>
    {unitPriceMinor && BigInt(unitPriceMinor) > 0n && <SaleBreakdown amounts={estimateSale(BigInt(unitPriceMinor), basisPoints)} grossLabel="Price per selling unit" netLabel="Estimated earnings per unit" />}
    <p>{ui(locale, "Each order shows its own commission and expected earnings before you accept.")}</p>
  </>;
}

export function SaleHistory() {
  const { locale } = useLanguage();
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const [data, setData] = useState<FarmerSaleHistory>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    customerApi(`financial/sales${cursor ? `?cursor=${cursor}` : ""}`)
      .then((result: FarmerSaleHistory) => { if (active) setData(result); })
      .catch((failure) => { if (active) setError(localizedError(locale, failure)); });
    return () => { active = false; };
  }, [cursor, locale, retry]);
  return <section className="sale-history">
    <h2>{ui(locale, "Sale earnings history")}</h2>
    {error ? <><p role="alert">{error}</p><button type="button" onClick={() => { setError(""); setRetry(retry + 1); }}>{ui(locale, "Retry")}</button></>
      : !data ? <p role="status">{ui(locale, "Loading…")}</p>
      : <>
        {!data.items.length && <p>{ui(locale, "No credited sales yet.")}</p>}
        {data.items.map((sale) => <article key={sale.id}>
          <h3><Link href={`/orders/${sale.orderId}`}>{sale.title} · {sale.reference}</Link></h3>
          <p>{dateLabel(locale, sale.createdAt)}</p>
          <SaleBreakdown amounts={sale} netLabel="Credited to you" />
        </article>)}
        {cursors.length > 0 && <button type="button" onClick={() => { setData(undefined); setCursors(cursors.slice(0, -1)); }}>{ui(locale, "Newer sales")}</button>}
        {data.nextCursor && <button type="button" onClick={() => { setData(undefined); setCursors([...cursors, data.nextCursor!]); }}>{ui(locale, "Older sales")}</button>}
      </>}
  </section>;
}
