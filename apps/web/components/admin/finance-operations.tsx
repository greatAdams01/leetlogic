"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatMoney as money } from "../../../../packages/contracts/src/money";
async function read(path: string) {
  const r = await fetch(`/api/admin/money/${path}`, { cache: "no-store" });
  const data = await r.json(); if (!r.ok) throw new Error(data.error?.message || "Finance records unavailable"); return data;
}
export function FinanceOperations({ orderId, manage, ready, reason, action }: { orderId?: string; manage: boolean; ready: boolean; reason: string; action: (path: string, body: any, step?: boolean) => Promise<void> }) {
  const [data,setData]=useState<any>(null),[cases,setCases]=useState<any[]>([]),[error,setError]=useState("");
  const [pickupDate,setPickupDate]=useState(new Date().toISOString().slice(0,10)),[minutes,setMinutes]=useState("60"),[notes,setNotes]=useState("");
  const [source,setSource]=useState(""),[destination,setDestination]=useState(""),[amount,setAmount]=useState(""),[reference,setReference]=useState(""),[statement,setStatement]=useState("");
  const [selected,setSelected]=useState<string[]>([]); const keys=useRef<Record<string,string>>({});
  const load=useCallback(async()=>{const suffix=orderId?`?orderId=${orderId}`:"";const [f,r]=await Promise.all([read(`finance${suffix}`),read(`recoveries${suffix}`)]);setData(f);setCases(r.items||[]);},[orderId]);
  useEffect(()=>{let active=true;let running=false;const update=()=>{if(running||document.visibilityState!=="visible")return;running=true;void load().catch(e=>{if(active)setError(e.message);}).finally(()=>{running=false;});};update();const timer=setInterval(update,30000);return()=>{active=false;clearInterval(timer);};},[load]);
  const run=async(path:string,body:any,step=true)=>{await action(path,body,step);await load().catch(e=>setError(e.message));};
  if(!data?.enabled)return error?<p role="alert">{error}</p>:null;
  const metrics:Record<string,string>={verifiedCollectionsMinor:"Verified customer collections",processingFeesMinor:"Provider processing fees",unallocatedMinor:"Unallocated verified payments",farmerAwaitingReleaseMinor:"Farmer funds awaiting release",farmerAvailableMinor:"Farmer available earnings",shippingCollectedMinor:"Shipping collected",courierCommitmentsMinor:"Courier commitments",courierChargesMinor:"Confirmed courier charges",earnedCommissionMinor:"Earned platform commission",platformExpensesMinor:"Business-borne expenses",refundDueMinor:"Refunds due",refundProcessingMinor:"Refunds processing",refundBlockedMinor:"Refunds blocked",refundCompletedMinor:"Refunds completed"};
  return <section>
    <h2>Collections, recovery and logistics funding</h2>
    <p>Collections are not platform income. Held ledger balances do not represent a separate escrow bank account. External business-bank balance: unavailable.</p>
    {data.heartbeat.stale&&<p role="alert">Payment recovery worker heartbeat is stale. Overdue refunds require immediate attention.</p>}
    <dl>{Object.entries(metrics).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{money(data.summary[key])}</dd></div>)}</dl>
    <h3>Amount to fund Shipbubble</h3>
    <p>Booking-ready costs: {money(data.funding.bookingReadyMinor)} · Existing commitments: {money(data.funding.committedMinor)}</p>
    <p>Observed wallet: {data.funding.walletMinor===null?"Unavailable":money(data.funding.walletMinor)} · Checked {data.funding.checkedAt?new Date(data.funding.checkedAt).toLocaleString():"never"}</p>
    <p>Usable wallet: {data.funding.usableWalletMinor===null?"Unverified":money(data.funding.usableWalletMinor)} · Required transfer: <strong>{data.funding.verified?money(data.funding.fundingShortfallMinor):"Unverified — reconcile wallet and uncertain purchases"}</strong></p>
    <p>Recorded, unverified transfers: {money(data.funding.recordedUnverifiedTransfersMinor)}. These do not fund bookings. Verified transfers are already included in the observed wallet; they are not subtracted twice.</p>
    {manage&&<button onClick={()=>void run("finance/refresh",{},false)}>Refresh provider wallet balance</button>}
    <table><thead><tr><th>Fund</th><th>Order / courier</th><th>Produce / top-up</th><th>Shipping collected / cost / surplus</th><th>Status / refund deadline</th></tr></thead><tbody>{data.shipments.map((s:any)=><tr key={s.deliveryId}>
      <td><input type="checkbox" aria-label={`Fund ${s.reference}`} checked={selected.includes(s.deliveryId)} disabled={!s.bookingReady} onChange={e=>setSelected(current=>e.target.checked?[...current,s.deliveryId]:current.filter(id=>id!==s.deliveryId))}/></td>
      <td>{s.reference}<br/>{s.courier||"Not selected"}</td><td>{money(s.produceMinor)} / {money(s.topupsMinor)}</td>
      <td>{money(s.shippingCollectedMinor)} / {s.courierCostMinor===null?"Unquoted":money(s.courierCostMinor)} / {money(s.refundableShippingSurplusMinor)}</td>
      <td>{s.state}{s.conditionalRecovery?" · Conditional recovery — excluded from funding":""}<br/>{s.deadline?.state} {s.deadline?.refundDueAt&&new Date(s.deadline.refundDueAt).toLocaleString()}<br/>{s.failureCode}</td>
    </tr>)}</tbody></table>
    <h3>Recovery and refund queue</h3>
    <p>Refund the produce and shipping principal if fulfillment is not secured within two hours. Bank credit can take longer. Staff acknowledgement does not extend the deadline.</p>
    {data.deadlines.filter((d:any)=>d.state!=="SECURED").map((d:any)=><p key={d.orderId}>{d.orderId} · {d.state} · Due {new Date(d.refundDueAt).toLocaleString()} · {d.failureCode}</p>)}
    {data.alerts.map((a:any)=><p role="alert" key={a.key}>{a.code} · {a.orderId||"Provider account"}</p>)}
    {manage&&<><label>Confirmed pickup date<input type="date" value={pickupDate} onChange={e=>setPickupDate(e.target.value)}/></label><label>Farmer preparation time (minutes)<input type="number" min="0" max="1440" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label><label>Completed farmer call details<textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={700}/></label></>}
    {cases.map(r=><article key={r.id}><h4>{r.reference} — {r.title}</h4><p>{r.state} · Payment {money(r.payment.amountMinor)} · Farmer {r.farmerConfirmedAt?"confirmed":"confirmation required"} · Proposal {r.version}</p>
      {r.proposal&&<p>Buyer {r.proposal.buyerAcceptedAt?"accepted":"has not accepted"} · Expires {new Date(r.proposal.expiresAt).toLocaleString()}</p>}
      {manage&&!r.allocatedAt&&!["REFUND_REQUIRED","REFUNDED"].includes(r.state)&&<>
        <button disabled={!ready||!pickupDate||!notes} onClick={()=>void run(`recoveries/${r.id}/farmer`,{reason,pickupDate,preparationMinutes:Number(minutes),notes,phoneConfirmation:true})}>Record completed farmer confirmation</button>
        <button disabled={!ready||!r.farmerConfirmedAt} onClick={()=>void run(`recoveries/${r.id}/proposal`,{reason})}>Prepare fresh recovery proposal</button>
        <button disabled={!ready||r.state!=="READY_FOR_APPROVAL"} onClick={()=>{keys.current[r.id] ||= crypto.randomUUID();void run(`recoveries/${r.id}/approve`,{reason,version:r.version,idempotencyKey:keys.current[r.id]});}}>Approve verified payment allocation</button>
        <button disabled={!ready} onClick={()=>void run(`recoveries/${r.id}/decline`,{reason})}>Resolve by refund</button>
      </>}
    </article>)}
    {manage&&data.flags.funding&&<><h3>Manual wallet funding</h3><p>Transfer through your approved banking process. This portal records and reconciles transfers; it does not send money.</p>
      <label>Transfer amount (kobo)<input inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value.replace(/\D/g,""))}/></label>
      <label>Source business account label<input value={source} onChange={e=>setSource(e.target.value)}/></label><label>Verified Shipbubble funding destination<input value={destination} onChange={e=>setDestination(e.target.value)}/></label>
      <button disabled={!ready||!selected.length||!amount||!source||!destination} onClick={()=>void run("funding",{amountMinor:amount,sourceLabel:source,destination,shipmentIds:selected,reason})}>Create funding batch for selected shipments</button>
      <label>Bank transfer reference<input value={reference} onChange={e=>setReference(e.target.value)}/></label><label>Statement reconciliation evidence / transaction reference<textarea value={statement} onChange={e=>setStatement(e.target.value)} minLength={10} maxLength={500}/></label>
      {data.batches.map((b:any)=><article key={b.id}><h4>{money(b.amountMinor)} — {b.state}</h4><p>{b.sourceLabel} → {b.destination} · {b.transferReference}</p>
        {b.state==="PLANNED"&&<button disabled={!ready||!reference||statement.length<10} onClick={()=>void run(`funding/${b.id}/record`,{transferReference:reference,statementReference:statement,reason})}>Record completed transfer</button>}
        {["PLANNED","TRANSFER_RECORDED"].includes(b.state)&&<label>Private evidence (PDF/JPEG/PNG, 500 KB)<input type="file" accept="application/pdf,image/png,image/jpeg" disabled={!ready} onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>512000){setError("Evidence must be at most 500 KB.");return;}const reader=new FileReader();reader.onload=()=>void run(`funding/${b.id}/evidence`,{base64:String(reader.result).split(",")[1],mime:file.type});reader.readAsDataURL(file);}}/></label>}
        {b.state==="TRANSFER_RECORDED"&&<button disabled={!ready||statement.length<10} onClick={()=>void run(`funding/${b.id}/verify`,{reason,statementReference:statement,reconciledStatement:true})}>Confirm statement reconciled and verify funding</button>}
        <a href={`/api/admin/money/funding/${b.id}/evidence`} target="_blank" rel="noreferrer">View private evidence</a>
        {["PLANNED","TRANSFER_RECORDED"].includes(b.state)&&<><button disabled={!ready} onClick={()=>void run(`funding/${b.id}/close`,{reason,state:"FAILED"})}>Mark failed transfer</button><button disabled={!ready} onClick={()=>void run(`funding/${b.id}/close`,{reason,state:"CANCELLED"})}>Cancel batch</button></>}
      </article>)}
    </>}
    <p role="alert">{error}</p>
  </section>;
}
