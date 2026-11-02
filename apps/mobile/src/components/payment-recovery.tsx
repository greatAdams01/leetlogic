import React, { useRef, useState } from "react";
import { useApp, useResource } from "../state";
import { api } from "../lib/api";
import { Button, Card, Heading, Label, Field, Notice } from "./ui";
import { money } from "../lib/domain";
import { fulfillmentLabel } from "../../../../packages/contracts/src/fulfillment-status";
export function PaymentRecovery({orderId}:{orderId?:string}) {
  const a=useApp(),r=useResource<{items:any[]}>("/orders/recoveries",true,30000);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[minutes,setMinutes]=useState("60"),[notes,setNotes]=useState("");const running=useRef(false);
  const act=async(id:string,path:string,body:any)=>{if(running.current)return;running.current=true;setBusy(true);setError("");try{await api(`/orders/recoveries/${id}/${path}`,{method:"POST",body});await r.reload();}catch(e){setError(a.error(e));}finally{running.current=false;setBusy(false);}};
  const items=Array.isArray(r.data?.items)?r.data.items.filter(i=>!orderId||i.orderId===orderId):[];
  if(!items.length)return null;
  return <>{items.map(i=><Card key={i.id}>
    <Heading>Payment recovery</Heading><Label>{i.title} · {i.reference}</Label><Label>{a.ui(fulfillmentLabel(i.state))}</Label>
    <Label>{i.deadline?.refundDueAt&&a.date(i.deadline.refundDueAt)}</Label>
    <Label>Refunds return produce and shipping. Processing fees may be non-returnable; bank credit can take longer.</Label>
    {!i.allocatedAt&&!["REFUND_REQUIRED","REFUNDED"].includes(i.state)&&(!i.isBuyer?<>
      <Field label="Pickup date" value={date} onChangeText={setDate}/><Field label="Preparation time (minutes)" value={minutes} onChangeText={setMinutes} keyboardType="numeric"/><Field label="Pickup instructions" value={notes} onChangeText={setNotes}/>
      <Button title="Confirm stock and pickup availability" disabled={busy} onPress={()=>void act(i.id,"farmer",{pickupDate:date,preparationMinutes:Number(minutes),notes})}/>
      <Button title="Cannot fulfill this order" secondary disabled={busy} onPress={()=>void act(i.id,"decline",{reason:"Farmer cannot fulfill the original order"})}/>
    </>:i.proposal&&<>
      <Label>{a.ui("Quantity")}: {i.proposal.snapshot.quantity}</Label><Label>{i.proposal.snapshot.pickupDate}</Label>
      <Label>{money(i.proposal.snapshot.produceMinor)}</Label>
      {i.proposal.snapshot.collection?<Button title="Accept recovery proposal" disabled={busy} onPress={()=>void act(i.id,"decision",{version:i.version,quoteId:null,accept:true})}/>:i.proposal.snapshot.options.map((q:any)=><Card key={q.id}>
        <Label>{q.courier} · {money(q.shippingMinor)}</Label><Label>{q.eta}</Label>
        <Label>{a.ui(BigInt(q.shippingMinor)>BigInt(i.proposal.snapshot.originalShippingMinor)?"Additional delivery payment required":"Refundable delivery surplus")}: {money((BigInt(q.shippingMinor)>BigInt(i.proposal.snapshot.originalShippingMinor)?BigInt(q.shippingMinor)-BigInt(i.proposal.snapshot.originalShippingMinor):BigInt(i.proposal.snapshot.originalShippingMinor)-BigInt(q.shippingMinor)).toString())}</Label>
        <Button title="Accept recovery proposal" disabled={busy||new Date(i.proposal.expiresAt)<=new Date()} onPress={()=>void act(i.id,"decision",{version:i.version,quoteId:q.id,accept:true})}/>
      </Card>)}
      <Button title="Request refund" secondary disabled={busy} onPress={()=>void act(i.id,"decision",{version:i.version,quoteId:null,accept:false})}/>
    </>)}
    {i.allocatedAt&&<Button title="View order & tracking" secondary onPress={()=>a.go("delivery",i.orderId)}/>}
  </Card>)}{error&&<Notice text={error} error/>}</>;
}
