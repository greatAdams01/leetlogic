"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { customerApi } from "../lib/customer-api";
import { useLanguage } from "./language-provider";
import { ui, localizedError } from "../../mobile/src/lib/localization";
import { fulfillmentLabel } from "../../../packages/contracts/src/fulfillment-status";
import { formatMoney as money } from "../../../packages/contracts/src/money";
export function CustomerRecovery({orderId}:{orderId?:string}) {
  const {locale}=useLanguage(); const [items,setItems]=useState<any[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[minutes,setMinutes]=useState("60"),[notes,setNotes]=useState(""),[choices,setChoices]=useState<Record<string,string>>({});
  const version=useRef(0),running=useRef(false);
  const load=useCallback(async()=>{const v=++version.current;const data=await customerApi("orders/recoveries");if(v===version.current)setItems(Array.isArray(data.items)?data.items.filter((r:any)=>!orderId||r.orderId===orderId):[]);},[orderId]);
  useEffect(()=>{let active=true;const read=()=>{if(document.visibilityState!=="visible"||running.current)return;void load().catch(e=>{if(active)setError(localizedError(locale,e));});};read();const timer=setInterval(read,30000);return()=>{active=false;version.current++;clearInterval(timer);};},[load,locale]);
  const act=async(id:string,path:string,body:any)=>{if(running.current)return;running.current=true;setBusy(true);setError("");try{await customerApi(`orders/recoveries/${id}/${path}`,body);await load();}catch(e){setError(localizedError(locale,e));}finally{running.current=false;setBusy(false);}};
  if(!items.length)return null;
  return <section><h2>{ui(locale,"Payment recovery")}</h2>{items.map(r=>{
    const p=r.proposal,s=p?.snapshot;const selected=choices[r.id]??p?.quoteId??s?.options?.[0]?.id??"";
    const q=s?.options?.find((q:any)=>q.id===selected);const increase=s&&q?BigInt(q.shippingMinor)-BigInt(s.originalShippingMinor):0n;
    return <article key={r.id}><h3>{r.title} · {r.reference}</h3><p>{ui(locale,fulfillmentLabel(r.state))}</p><p>{r.deadline?.refundDueAt&&new Date(r.deadline.refundDueAt).toLocaleString()} · {ui(locale,"Refunds return produce and shipping. Processing fees may be non-returnable; bank credit can take longer.")}</p>
      {r.isBuyer&&r.payment.amountMinor&&<p>{ui(locale,"Payment confirmed")}: {money(r.payment.amountMinor)}</p>}
      {!r.allocatedAt&&!["REFUND_REQUIRED","REFUNDED"].includes(r.state)&&(!r.isBuyer?<>
        <label>{ui(locale,"Pickup date")}<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
        <label>{ui(locale,"Preparation time (minutes)")}<input type="number" value={minutes} min="0" max="1440" onChange={e=>setMinutes(e.target.value)}/></label>
        <label>{ui(locale,"Pickup instructions")}<textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={700}/></label>
        <button disabled={busy} onClick={()=>void act(r.id,"farmer",{pickupDate:date,preparationMinutes:Number(minutes),notes})}>{ui(locale,"Confirm stock and pickup availability")}</button>
        <button disabled={busy} onClick={()=>void act(r.id,"decline",{reason:"Farmer cannot fulfill the original order"})}>{ui(locale,"Cannot fulfill this order")}</button>
      </>:p&&<>
        <p>{ui(locale,"Quantity")}: {s.quantity} · {ui(locale,"Pickup date")}: {s.pickupDate}</p>
        <p>{ui(locale,"Produce")}: {money(s.produceMinor)}</p>
        {!s.collection&&<select aria-label={ui(locale,"Select delivery service")} value={selected} disabled={busy} onChange={e=>setChoices(current=>({...current,[r.id]:e.target.value}))}>{s.options.map((q:any)=><option key={q.id} value={q.id}>{q.courier} · {money(q.shippingMinor)} · {q.eta}</option>)}</select>}
        {q&&<p>{ui(locale,increase>0n?"Additional delivery payment required":"Refundable delivery surplus")}: {money(increase>0n?increase:-increase)}</p>}
        <button disabled={busy||new Date(p.expiresAt)<=new Date()} onClick={()=>void act(r.id,"decision",{version:r.version,quoteId:s.collection?null:selected,accept:true})}>{ui(locale,"Accept recovery proposal")}</button>
        <button disabled={busy} onClick={()=>void act(r.id,"decision",{version:r.version,quoteId:null,accept:false})}>{ui(locale,"Request refund")}</button>
      </>)}
    </article>;
  })}<p role="alert">{error}</p></section>;
}
