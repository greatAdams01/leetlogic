import { describe, expect, it } from "vitest";
import { shippingFundingRequirement } from "./logistics-finance.js";
import { refundDeadline, overdue } from "./fulfillment-deadline.js";
describe("fulfillment finance policy",()=>{
  const now=new Date("2026-11-02T12:00:00Z");
  const valid={ready:10000n,committed:2000n,wallet:7000n,checkedAt:now,error:false,uncertain:false};
  it("funds the shortfall after reserving wallet commitments once",()=>{
    expect(shippingFundingRequirement(valid,now)).toEqual({verified:true,usableWalletMinor:5000n,fundingShortfallMinor:5000n});
    expect(shippingFundingRequirement({...valid,wallet:20000n},now).fundingShortfallMinor).toBe(0n);
  });
  it("does not invent zero balances or available money from stale and uncertain observations",()=>{
    for(const input of [{...valid,wallet:null},{...valid,error:true},{...valid,uncertain:true},{...valid,checkedAt:new Date(now.getTime()-300001)}])
      expect(shippingFundingRequirement(input,now)).toEqual({verified:false,usableWalletMinor:null,fundingShortfallMinor:null});
  });
  it("bounds usable wallet at zero and never creates a negative transfer",()=>{
    expect(shippingFundingRequirement({...valid,committed:10000n},now).fundingShortfallMinor).toBe(10000n);
    expect(shippingFundingRequirement({...valid,incoming:20000n},now).fundingShortfallMinor).toBe(0n);
  });
  it("supports configured deadlines from the provider completion time",()=>{
    expect(refundDeadline(now, 15).toISOString()).toBe("2026-11-02T12:15:00.000Z");
    expect(refundDeadline(now, 180).toISOString()).toBe("2026-11-02T15:00:00.000Z");
  });
  it("expires exactly two hours after provider completion by default",()=>{
    const due=refundDeadline(now);expect(due.toISOString()).toBe("2026-11-02T14:00:00.000Z");
    expect(overdue(due,new Date(due.getTime()-1))).toBe(false);expect(overdue(due,due)).toBe(true);
  });
});
