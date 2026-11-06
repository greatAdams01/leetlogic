vi.mock("../components/checkout-delivery-address", () => ({ CheckoutDeliveryAddress: "CheckoutDeliveryAddress" }));
vi.mock("../components/receipt-confirmation", () => ({ ReceiptConfirmation: "ReceiptConfirmation" }));
vi.mock("./produce-photo", () => ({ choosePhoto: vi.fn(), photoBody: vi.fn() }));
vi.mock("../components/app-sheet", () => ({ AppSheet: () => null }));
vi.mock("../components/order-disputes", () => ({ OrderDisputes: "OrderDisputes" }));
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  api: vi.fn(),
  alert: vi.fn(),
  back: vi.fn(),
  returnTo: vi.fn(),
  go: vi.fn(),
  query: undefined as string | undefined,
  reload: vi.fn(),
  user: null as any,
  data: null as any,
}));
vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  StyleSheet: { create: (styles: any) => styles },
  Linking: { openURL: vi.fn() },
}));
vi.mock("../components/Select", () => ({ Select: "Select" }));
vi.mock("../components/order-payment", () => ({ OrderPayment: "OrderPayment" }));
vi.mock("../localization", () => ({ LocalizedText: "Text" }));
vi.mock("../components/ui", async () => {
  const { createElement } = await import("react");
  return {
    Page: ({ children, footer, subheader, ...props }: any) => createElement("Page", props, subheader, children, footer),
    Heading: "Heading",
    Label: "Label",
    Field: "Field",
    Button: "Button",
    Card: "Card",
    Notice: "Notice",
    Icon: "Icon",
    s: {},
    colors: {},
  };
});
vi.mock("./api", () => ({ api: h.api }));
vi.mock("../state", () => ({
  useApp: () => ({
    route: { id: "order", query: h.query },
    user: h.user,
    back: h.back,
    alert: h.alert,
    returnTo: h.returnTo,
    go: h.go,
    status: (s: string) => s,
    unit: (s: string) => s,
    t: (s: string) => s,
    date: (s: string) => s,
    error: (e: Error) => e.message,
    ui: (s: string, params: Record<string, unknown> = {}) =>
      s.replace(/\{(\w+)\}/g, (_, key) => String(params[key])),
  }),
  useResource: () => ({ data: h.data, reload: h.reload, loading: false, error: "" }),
}));
import { Quotes, Delivery } from "../screens/delivery";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
const field = (label: string) =>
  tree.root.findAllByType("Field" as any).find((node) => node.props.label === label)!;
const submit = () =>
  tree.root
    .findAllByType("Button" as any)
    .find((node) => node.props.title === "Continue to delivery options")!
    .props.onPress();
beforeEach(() => {
  vi.clearAllMocks();
  h.query = undefined;
  h.api.mockReset();
  h.api.mockResolvedValue({ items: [] });
  h.reload.mockResolvedValue(undefined);
  h.user = { addresses: [{id:"default-home",label:"Home",line1:"25 Buyer Avenue",city:"Ikeja",lga:"Ikeja",state:"Lagos",isDefaultDelivery:true}], profile: {fullName:"Buyer",email:"buyer@example.test"}, phoneE164: "+2348012345678" };
  h.data = {
    order: {
      id: "order",
      checkoutReady: false,
      checkoutActive: false,
      payableMinor: null,
      totalWithDeliveryMinor: null,
      suggestedPickup: {
        name: "Farmer",
        email: "farm@example.test",
        address: "Test farm address Lagos",
        state: "Lagos",
      },
      packageSuggestion: {
        packageCount: 2,
        weightKg: 50,
        length: null,
        width: null,
        height: null,
        handling: "PERISHABLE",
        notes: "Keep upright",
        needsPackedDimensions: true,
        farmer: { notes: "Keep upright" },
      },
    },
    delivery: null,
  };
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  vi.useRealTimers();
});
it("shows seller measurements without allowing buyers to reduce shipment weight", async () => {
  h.data.order.packageSuggestion = { ...h.data.order.packageSuggestion, length: 50, width: 40, height: 30 };
  await act(async () => { tree = create(<Quotes />); });
  expect(field("Total packed weight (kg)")).toBeUndefined();
  expect(field("Length (cm)")).toBeUndefined();
  h.api.mockResolvedValueOnce({ items: [{ id: "rate" }] });
  await act(async () => submit());
  expect(h.api).toHaveBeenLastCalledWith("/orders/order/delivery/quotes", expect.objectContaining({ body: expect.objectContaining({ parcel: expect.objectContaining({ packageCount: 2, weightKg: 50, length: 50, width: 40, height: 30 }) }) }));
  expect(h.returnTo).toHaveBeenCalledWith("delivery", "order", "delivery-carriers");
});
it("requires missing seller measurements to be completed before quoting", async () => {
  h.data.order.packageSuggestion = null;
  await act(async () => { tree = create(<Quotes />); });
  expect(tree.root.findAllByType("Button" as any).find((node) => node.props.title === "Continue to delivery options")!.props.disabled).toBe(true);
  expect(h.api).not.toHaveBeenCalled();
});
it("offers pickup and delivery only, and opens produce-only pickup payment", async () => {
  h.data = {
    ...h.data,
    order: { ...h.data.order, isBuyer: true, status: "AWAITING_PAYMENT", totalMinor: "10000" },
  };
  await act(async () => {
    tree = create(<Delivery />);
  });
  const headings = () =>
    tree.root.findAllByType("Heading" as any).map((node) => node.props.children);
  expect(headings()).toContain("Pickup or delivery?");
  expect(
    tree.root
      .findAllByType("Label" as any)
      .map((node) => node.props.children)
      .join(" "),
  ).not.toContain("International");
  const choices = tree.root
    .findAllByType("Pressable" as any)
    .filter((node) => node.props.accessibilityRole === "button");
  await act(async () => choices[0]!.props.onPress());
  expect(h.api).toHaveBeenCalledWith("/orders/order/delivery/collection", {
    method: "POST",
    body: {},
  });
  expect(h.reload).toHaveBeenCalledOnce();
   h.data = { ...h.data, order: { ...h.data.order, checkoutReady: true, payableMinor: "10000", totalWithDeliveryMinor: "10000" }, delivery: { status: "PICKUP_PENDING", shippingMinor: "0", quotes: [], selectedQuoteId: null } };
  await act(async () => tree.update(<Delivery />));
  expect(headings()).toContain("Pickup");
  expect(tree.root.findAllByType("OrderPayment" as any)).toHaveLength(1);
  expect(
    tree.root
      .findAllByType("Label" as any)
      .map((node) => node.props.children)
      .join(" "),
  ).not.toContain("quote expired");
});

it("reviews distinct farmer and buyer addresses with farmer packing prefilled and uses seller packing for pricing", async () => {
  h.user.addresses = [
    {
      id: "buyer-home",
      isDefaultDelivery: true,
      latitude: "9.08",
      longitude: "7.4",
      line1: "42 Buyer Avenue",
      city: "Abuja",
      lga: "Bwari",
      state: "FCT",
    },
  ];
  h.data.order.packageSuggestion = {
    ...h.data.order.packageSuggestion,
    packageCount: 1,
    weightKg: 25,
    length: 50,
    width: 40,
    height: 30,
    farmer: { length: 50, width: 40, height: 30, notes: "Keep upright" },
  };
  await act(async () => {
    tree = create(<Quotes />);
  });
  const labels = () =>
    tree.root
      .findAllByType("Label" as any)
      .map((node) => node.props.children)
      .flat()
      .join(" ");
  expect(labels()).toContain("Pickup Location");
  expect(labels()).toContain("Test farm address Lagos");
  expect(labels()).toContain("Delivery Destination");
  expect(labels()).toContain("42 Buyer Avenue, Abuja, Bwari");
  expect(labels()).toContain("Keep upright");
  expect(field("Total packed weight (kg)")).toBeUndefined();
  expect(field("Delivery address")).toBeUndefined();
  await act(async () => submit());
  expect(h.api).toHaveBeenLastCalledWith(
    "/orders/order/delivery/quotes",
    expect.objectContaining({
      body: expect.objectContaining({
        pickup: expect.objectContaining({ address: "Test farm address Lagos", state: "Lagos" }),
        destination: expect.objectContaining({
          address: "42 Buyer Avenue, Abuja, Bwari",
          state: "FCT",
          latitude: 9.08,
          longitude: 7.4,
        }),
        parcel: expect.objectContaining({
          weightKg: 25,
          length: 50,
          width: 40,
          height: 30,
          notes: "Keep upright",
        }),
      }),
    }),
  );
});

it("keeps an empty provider result actionable without sending the buyer to staff confirmation", async () => {
  h.data.order.packageSuggestion = { ...h.data.order.packageSuggestion, length: 50, width: 40, height: 30 };
  h.api.mockResolvedValueOnce({ items: [] });
  await act(async () => { tree = create(<Quotes />); });
  await act(async () => submit());
  expect(h.returnTo).not.toHaveBeenCalled();
  expect(tree.root.findAllByType("Notice" as any).some((node) => node.props.error)).toBe(true);
});
it("resumes a manual review result without repeating the pickup or delivery choice", async () => {
  h.query = "delivery-review";
  h.data.order = {
    ...h.data.order,
    isBuyer: true,
    status: "AWAITING_PAYMENT",
    totalMinor: "10000",
  };
  h.data.delivery = {
    status: "MANUAL_REVIEW",
    quotes: [],
    destination: { address: "Buyer home", state: "FCT" },
  };
  await act(async () => {
    tree = create(<Delivery />);
  });
  const headings = tree.root.findAllByType("Heading" as any).map((node) => node.props.children);
  expect(headings).toContain("Delivery review pending");
  expect(headings).not.toContain("Pickup or delivery?");
  expect(tree.root.findAllByType("OrderPayment" as any)).toHaveLength(0);
});

it("clears a saved map pin when the buyer edits the delivery address", async () => {
  h.data.delivery = {
    destination: {
      name: "Buyer",
      phone: "+2348012345678",
      email: "buyer@example.test",
      address: "Old delivery address Abuja",
      state: "FCT",
      country: "NG",
      latitude: 9.08,
      longitude: 7.4,
    },
  };
  h.data.order.packageSuggestion = {
    ...h.data.order.packageSuggestion,
    length: 20,
    width: 10,
    height: 20,
  };
  await act(async () => {
    tree = create(<Quotes />);
  });
  await act(async () =>
    tree.root
      .findAllByType("Button" as any)
      .find((node) => node.props.title === "Edit delivery details")!
      .props.onPress(),
  );
  await act(async () => tree.root.findByType("CheckoutDeliveryAddress" as any).props.onSaved({id:"edited",label:"Home",line1:"New delivery address Abuja",city:"Kubwa",lga:"Bwari",state:"FCT"}));
  await act(async () => submit());
  const body = h.api.mock.calls.at(-1)![1].body;
  expect(body.destination.address).toBe("New delivery address Abuja, Kubwa, Bwari");
  expect(body.destination.latitude).toBeUndefined();
  expect(body.destination.longitude).toBeUndefined();
});

const carriers = () => {
  h.data = {
    ...h.data,
    order: { ...h.data.order, isBuyer: true, status: "AWAITING_PAYMENT", totalMinor: "10000", title: "Beans" },
    delivery: {
      status: "QUOTED", selectedQuoteId: null, shippingMinor: "0", destination: { state: "Lagos" },
      quotes: ["first", "second"].map((id) => ({ id, courier: id, amountMinor: "1000", available: true, expiresAt: new Date(Date.now() + 60000).toISOString() })),
    },
  };
};
const radios = () => tree.root.findAllByType("Pressable" as any).filter((node) => node.props.accessibilityRole === "radio");

it("disables expired and unavailable courier cards before any selection request", async () => {
  carriers();
  h.data.delivery.quotes[0].expiresAt = new Date(Date.now() - 1).toISOString();
  h.data.delivery.quotes[1].available = false;
  await act(async () => { tree = create(<Delivery />); });
  expect(radios().every((node) => node.props.disabled)).toBe(true);
  await act(async () => radios().forEach((node) => node.props.onPress()));
  expect(h.api).not.toHaveBeenCalled();
  expect(tree.root.findAllByType("Button" as any).find((node) => node.props.title === "Continue")!.props.disabled).toBe(true);
});

it("expires a selected carrier while mounted and rejects its saved selection handler", async () => {
  vi.useFakeTimers();
  carriers();
  h.data.order.checkoutReady = true;
  h.data.delivery.selectedQuoteId = "first";
  h.data.delivery.quotes[0].expiresAt = new Date(Date.now() + 1000).toISOString();
  await act(async () => { tree = create(<Delivery />); });
  const press = radios()[0]!.props.onPress;
  expect(tree.root.findAllByType("Button" as any).find((node) => node.props.title === "Continue")!.props.disabled).toBe(false);
  await act(async () => {
    vi.advanceTimersByTime(1001);
  });
  expect(tree.root.findAllByType("Button" as any).find((node) => node.props.title === "Continue")!.props.disabled).toBe(true);
  await act(async () => press());
  expect(h.api).not.toHaveBeenCalled();
});

it("submits only one carrier selection and waits for authoritative server readiness", async () => {
  carriers();
  let resolveSelection!: (value: any) => void;
  h.api.mockImplementationOnce(() => new Promise((resolve) => { resolveSelection = resolve; }));
  await act(async () => { tree = create(<Delivery />); });
  const [first, second] = radios().map((node) => node.props.onPress);
  await act(async () => { first(); second(); });
  expect(h.api).toHaveBeenCalledOnce();
  expect(h.api).toHaveBeenCalledWith("/orders/order/delivery/select", { method: "POST", body: { quoteId: "first" } });
  await act(async () => resolveSelection({ shippingMinor: "1" }));
  expect(h.reload).toHaveBeenCalledOnce();
  expect(tree.root.findAllByType("Button" as any).find((node) => node.props.title === "Continue")!.props.disabled).toBe(true);
  expect(radios().some((node) => node.props.accessibilityState.selected)).toBe(false);
});

it("reloads a saved carrier choice after its response is lost", async () => {
  carriers();
  h.api.mockImplementationOnce(async () => {
    h.data = { ...h.data, order: { ...h.data.order, checkoutReady: true, payableMinor: "11000" }, delivery: { ...h.data.delivery, selectedQuoteId: "first", shippingMinor: "1000" } };
    throw new Error("Response lost");
  });
  h.reload.mockImplementation(async () => { tree.update(<Delivery />); });
  await act(async () => { tree = create(<Delivery />); });
  await act(async () => radios()[0]!.props.onPress());
  expect(h.reload).toHaveBeenCalledOnce();
  expect(radios()[0]!.props.accessibilityState.selected).toBe(true);
  expect(tree.root.findAllByType("Button" as any).find((node) => node.props.title === "Continue")!.props.disabled).toBe(false);
  expect(h.api).toHaveBeenCalledOnce();
});

it("updates server-owned packing on reload without discarding local destination and date edits", async () => {
  h.data.order.packageSuggestion = { ...h.data.order.packageSuggestion, length: 20, width: 15, height: 10 };
  h.data.delivery = { destination: { name: "Buyer", phone: "+2348012345678", email: "buyer@example.test", address: "Old buyer address Lagos", state: "Lagos", country: "NG" } };
  await act(async () => { tree = create(<Quotes />); });
  await act(async () => tree.root.findAllByType("Button" as any).find((node) => node.props.title === "Edit delivery details")!.props.onPress());
  await act(async () => tree.root.findByType("CheckoutDeliveryAddress" as any).props.onSaved({id:"edited",label:"Home",line1:"New buyer address Lagos",city:"Ikeja",lga:"Ikeja",state:"Lagos"}));
  const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  await act(async () => field("Pickup date · YYYY-MM-DD").props.onChangeText(date));
  h.data = { ...h.data, order: { ...h.data.order, packageSuggestion: { ...h.data.order.packageSuggestion, packageCount: 3, weightKg: 151.5, length: 60 } } };
  await act(async () => tree.update(<Quotes />));
  h.api.mockResolvedValueOnce({ items: [{ id: "new-rate" }] });
  await act(async () => submit());
  expect(h.api).toHaveBeenCalledWith("/orders/order/delivery/quotes", expect.objectContaining({ body: expect.objectContaining({
    destination: expect.objectContaining({ address: "New buyer address Lagos, Ikeja, Ikeja" }),
    parcel: expect.objectContaining({ packageCount: 3, weightKg: 151.5, length: 60, pickupDate: date }),
  }) }));
});

it("guards quote submissions against two presses before the component rerenders", async () => {
  h.data.order.packageSuggestion = { ...h.data.order.packageSuggestion, length: 20, width: 15, height: 10 };
  let resolveQuotes!: (value: any) => void;
  h.api.mockImplementationOnce(() => new Promise((resolve) => { resolveQuotes = resolve; }));
  await act(async () => { tree = create(<Quotes />); });
  const press = tree.root.findAllByType("Button" as any).find((node) => node.props.title === "Continue to delivery options")!.props.onPress;
  await act(async () => {
    const first = press();
    const second = press();
    expect(h.api).toHaveBeenCalledOnce();
    resolveQuotes({ items: [{ id: "rate" }] });
    await Promise.all([first, second]);
  });
  expect(h.returnTo).toHaveBeenCalledOnce();
});

it("hides the prepayment collection call action even if a stale response includes contact details", async () => {
  Object.assign(h.data.order,{isBuyer:true,status:"AWAITING_PAYMENT",reference:"order",title:"Beans",totalMinor:"10000",pickupContactAvailable:true});
  h.data.order.suggestedPickup.phone="+2348098765432";
  h.data.delivery={status:"PICKUP_PENDING",quotes:[],shippingMinor:"0",paidMinor:"0",selectedQuoteId:null};
  await act(async()=>{tree=create(<Delivery/>);});
  expect(tree.root.findAllByType("Button" as any).some(n=>n.props.title==="Call farmer")).toBe(false);
  expect(tree.root.findAllByType("Label" as any).flatMap(n=>n.children).filter(c=>typeof c === "string").join(" ")).not.toContain("+2348098765432");
});
it.each([false,undefined])("requires explicit backend contact permission on a paid order (%s)", async permission => {
  Object.assign(h.data.order,{isBuyer:true,status:"FUNDED",reference:"order",title:"Beans",totalMinor:"10000",pickupContactAvailable:permission});
  h.data.order.suggestedPickup.phone="+2348098765432";
  h.data.delivery={status:"PICKUP_READY",events:[],quotes:[],shippingMinor:"0",paidMinor:"0",selectedQuoteId:null};
  await act(async()=>{tree=create(<Delivery/>);});
  expect(tree.root.findAllByType("Button" as any).some(n=>n.props.title==="Call farmer")).toBe(false);
  expect(tree.root.findAllByType("Label" as any).flatMap(n=>n.children).filter(c=>typeof c === "string").join(" ")).not.toContain("+2348098765432");
});
it.each(["PICKUP_PREPARING", "PICKUP_READY"])("allows the farmer call action after verified payment allocation (%s)", async status => {
  Object.assign(h.data.order,{isBuyer:true,status:"FUNDED",reference:"order",title:"Beans",totalMinor:"10000",pickupContactAvailable:true});
  h.data.order.suggestedPickup.phone="+2348098765432";
  h.data.delivery={status,events:[],quotes:[],shippingMinor:"0",paidMinor:"0",selectedQuoteId:null};
  h.data.progress={method:"Pickup",status:"Preparing for Pickup"};
  await act(async()=>{tree=create(<Delivery/>);});

  expect(tree.root.findAllByType("Button" as any).some(n=>n.props.title==="Call farmer")).toBe(true);
});

it("offers a safe route back to the produce when an unpaid reservation expired",async()=>{
  Object.assign(h.data.order,{id:"order",listingId:"produce",isBuyer:true,status:"CANCELLED",checkoutErrorCode:"ORDER_EXPIRED",reference:"order",title:"Beans",totalMinor:"10000"});
  await act(async()=>{tree=create(<Delivery/>);});
  const action=tree.root.findAllByType("Button" as any).find(n=>n.props.title==="View produce");
  expect(action).toBeDefined();action!.props.onPress();expect(h.go).toHaveBeenCalledWith("product","produce");
});

it("keeps farmer readiness visible while expanding payment details",async()=>{
  Object.assign(h.data.order,{id:"order",isBuyer:false,status:"FUNDED",reference:"ORDER",title:"Beans",totalMinor:"10000"});
  h.data.delivery={status:"BOOKED",events:[],quotes:[],shippingMinor:"1000",paidMinor:"1000",selectedQuoteId:"q"};
  h.data.progress={method:"Delivery",status:"Preparing for Pickup",next:"Prepare the produce, then mark it ready.",steps:["Payment confirmed","Preparing","Dispatched","In Transit","Completed"],stage:1,canReady:true,canDispatch:false,canConfirm:false,confirmed:false};
  await act(async()=>{tree=create(<Delivery/>);});
  expect(tree.root.findAllByType("OrderPayment" as any)).toHaveLength(0);
  expect(tree.root.findAllByType("Pressable" as any).filter(n=>n.props.accessibilityRole==="tab")).toHaveLength(0);
  await act(async()=>tree.root.findAllByType("Pressable" as any).find(n=>n.props.accessibilityLabel==="Payment and receipt")!.props.onPress());
  expect(tree.root.findAllByType("OrderPayment" as any)).toHaveLength(1);
  const press=tree.root.findAllByType("Button" as any).find(n=>n.props.title==="Ready for Rider Pickup")!.props.onPress;
  await act(async()=>{await Promise.all([press(),press()]);});
  expect(h.api.mock.calls.filter(([path])=>path==="/orders/order/delivery/ready")).toHaveLength(1);
});
it("opens photo inspection without prematurely confirming buyer pickup",async()=>{
  Object.assign(h.data.order,{id:"order",isBuyer:true,status:"FUNDED",reference:"ORDER",title:"Beans",totalMinor:"10000"});
  h.data.delivery={status:"PICKUP_READY",events:[],quotes:[]};
  h.data.progress={method:"Pickup",status:"Ready for Pickup",canConfirm:true,confirmed:false};
  await act(async()=>{tree=create(<Delivery/>);});
  await act(async()=>tree.root.findAllByType("Button" as any).find(n=>n.props.title==="Confirm Receipt")!.props.onPress());
  expect(h.api).not.toHaveBeenCalled();
  expect(tree.root.findByType("ReceiptConfirmation" as any).props.visible).toBe(true);
});

it.each(["Pickup", "Delivery"])(
  "shows no obsolete farmer actions while awaiting confirmation (%s)",
  async (method) => {
    Object.assign(h.data.order, {
      id: "order",
      isBuyer: false,
      reference: "ORDER",
      title: "Beans",
      totalMinor: "10000",
    });
    h.data.delivery = {
      status: method === "Pickup" ? "PICKUP_READY" : "IN_TRANSIT",
      events: [],
      quotes: [],
    };
    h.data.progress = {
      method,
      status: method === "Pickup" ? "Ready for Pickup" : "In Transit",
      canReady: false,
      canDispatch: false,
      confirmed: false,
    };
    await act(async () => {
      tree = create(<Delivery />);
    });
    const actions = tree.root.findAllByType("Button" as any).map((n) => n.props.title);
    expect(actions).not.toContain("Mark as Ready for Pickup");
    expect(actions).not.toContain("Mark as Dispatched");
    expect(
      tree.root
        .findAllByType("Pressable" as any)
        .filter((n) => n.props.accessibilityRole === "tab"),
    ).toHaveLength(0);
  },
);

it("blocks Step 1 until an address is saved and carries that exact address into delivery review", async () => {
  h.user.addresses = [];
  h.data.order = { ...h.data.order, isBuyer:true, status:"AWAITING_PAYMENT", totalMinor:"10000" };
  await act(async()=>{tree=create(<Delivery/>);});
  const deliveryChoice=tree.root.findAllByType("Pressable" as any).filter(node=>node.props.accessibilityRole==="button")[1]!;
  await act(async()=>deliveryChoice.props.onPress());
  const next=()=>tree.root.findAllByType("Button" as any).find(node=>node.props.title==="Continue")!;
  expect(next().props.disabled).toBe(true);
  await act(async()=>next().props.onPress());expect(h.go).not.toHaveBeenCalled();
  const saved={id:"new-home",label:"Home",line1:"25 Market Road",city:"Ikeja",state:"Lagos",lga:"Ikeja"};
  await act(async()=>tree.root.findByType("CheckoutDeliveryAddress" as any).props.onSaved(saved));
  expect(next().props.disabled).toBe(false);
  expect(h.go).not.toHaveBeenCalled();
  await act(async()=>next().props.onPress());
  expect(h.go).toHaveBeenCalledWith("quotes","order","new-home");
});
it("prefers the saved address selected in Step 1 over a previous delivery destination",async()=>{
  const saved={id:"selected-home",label:"Office",line1:"25 Market Road",city:"Ikeja",state:"Lagos",lga:"Ikeja"};
  h.user.addresses=[saved];h.query=saved.id;
  h.data.delivery={status:"QUOTED",destination:{name:"Buyer",phone:"+2348000000000",email:"buyer@test.com",address:"Old destination",state:"Abuja"},quotes:[]};
  await act(async()=>{tree=create(<Quotes/>);});
  expect(JSON.stringify(tree.toJSON())).toContain("25 Market Road");
  expect(JSON.stringify(tree.toJSON())).not.toContain("Old destination");
});

it("advances to delivery review immediately after the current map location is saved",async()=>{
  h.data.order={...h.data.order,isBuyer:true,status:"AWAITING_PAYMENT",totalMinor:"10000"};
  await act(async()=>{tree=create(<Delivery/>);});
  await act(async()=>tree.root.findAllByType("Pressable" as any).filter(node=>node.props.accessibilityRole==="button")[1]!.props.onPress());
  const saved={id:"map-home",label:"Delivery location",line1:"25 Market Road",city:"Ikeja",state:"Lagos",lga:"Ikeja"};
  await act(async()=>tree.root.findByType("CheckoutDeliveryAddress" as any).props.onLocationSaved(saved));
  expect(h.go).toHaveBeenCalledWith("quotes","order","map-home");
});
it("waits for a selected address that hydrates after the order instead of using a different default",async()=>{
  h.query="selected-late";
  h.user.addresses=[{id:"wrong",label:"Old home",line1:"An old delivery street",city:"Ikeja",state:"Lagos",lga:"Ikeja",isDefaultDelivery:true}];
  h.data.order.packageSuggestion={...h.data.order.packageSuggestion,length:20,width:15,height:10};
  await act(async()=>{tree=create(<Quotes/>);});
  expect(JSON.stringify(tree.toJSON())).not.toContain("An old delivery street");
  expect(tree.root.findAllByType("Button" as any).find(n=>n.props.title==="Continue to delivery options")!.props.disabled).toBe(true);
  h.user={...h.user,addresses:[...h.user.addresses,{id:"selected-late",label:"New home",line1:"25 Newly Selected Road",city:"Ikeja",state:"Lagos",lga:"Ikeja",latitude:6.6,longitude:3.3,postalCode:null,line2:"Use side gate"}]};
  await act(async()=>tree.update(<Quotes/>));
  h.api.mockResolvedValueOnce({items:[{id:"rate"}]});await act(async()=>submit());
  expect(h.api).toHaveBeenCalledWith("/orders/order/delivery/quotes",expect.objectContaining({body:expect.objectContaining({destination:expect.objectContaining({addressId:"selected-late",latitude:6.6,longitude:3.3,postalCode:null,instructions:"Use side gate"})})}));
});
it("requests only the missing contact email after a location is already captured",async()=>{
  h.user.profile={fullName:"Buyer"};
  h.data.order.packageSuggestion={...h.data.order.packageSuggestion,length:20,width:15,height:10};
  await act(async()=>{tree=create(<Quotes/>);});
  expect(field("Email")).toBeTruthy();expect(field("Full name")).toBeUndefined();expect(field("Phone")).toBeUndefined();expect(field("Delivery address")).toBeUndefined();
  expect(tree.root.findAllByType("Button" as any).find(n=>n.props.title==="Continue to delivery options")!.props.disabled).toBe(true);
  await act(async()=>field("Email").props.onChangeText("delivery@example.test"));
  h.api.mockResolvedValueOnce({items:[{id:"rate"}]});await act(async()=>submit());
  expect(h.api).toHaveBeenCalledWith("/orders/order/delivery/quotes",expect.objectContaining({body:expect.objectContaining({destination:expect.objectContaining({addressId:"default-home",email:"delivery@example.test"})})}));
});
it("keeps missing contact fields editable after their values first become valid", async () => {
  h.user.profile = { fullName: "Buyer" };
  h.user.phoneE164 = "";
  await act(async () => { tree = create(<Quotes />); });
  await act(async () => field("Phone").props.onChangeText("0801234567"));
  expect(field("Phone")).toBeDefined();
  await act(async () => field("Phone").props.onChangeText("08012345678"));
  await act(async () => field("Email").props.onChangeText("buyer@example.co"));
  expect(field("Email")).toBeDefined();
  await act(async () => field("Email").props.onChangeText("buyer@example.com"));
  expect(field("Phone").props.value).toBe("08012345678");
  expect(field("Email").props.value).toBe("buyer@example.com");
});
it("retains contact entered before the order and saved address finish loading", async () => {
  h.user.profile = { fullName: "Buyer" };
  const loaded = { ...h.data, order: { ...h.data.order,
    packageSuggestion: { ...h.data.order.packageSuggestion, length: 20, width: 15, height: 10 } } };
  h.data = null;
  await act(async () => { tree = create(<Quotes />); });
  await act(async () => field("Email").props.onChangeText("local-contact@example.test"));
  h.data = loaded;
  await act(async () => tree.update(<Quotes />));
  expect(field("Email").props.value).toBe("local-contact@example.test");
  h.api.mockResolvedValueOnce({ items: [{ id: "rate" }] });
  await act(async () => submit());
  expect(h.api.mock.calls.at(-1)![1].body.destination.email).toBe("local-contact@example.test");
});
it.each([null, {}, { items: "rate" }, { items: { length: 1 } }, { items: [null] }])(
  "does not advance on a malformed quote response (%j)", async response => {
    h.data.order.packageSuggestion = { ...h.data.order.packageSuggestion, length: 20, width: 15, height: 10 };
    h.api.mockResolvedValueOnce(response);
    await act(async () => { tree = create(<Quotes />); });
    await act(async () => submit());
    expect(h.returnTo).not.toHaveBeenCalled();
    expect(h.reload).toHaveBeenCalledOnce();
    expect(tree.root.findAllByType("Notice" as any).some(node => node.props.error)).toBe(true);
  },
);
it("keeps edited contact and pickup date while changing the selected saved destination", async () => {
  h.data.order.packageSuggestion = { ...h.data.order.packageSuggestion, length: 20, width: 15, height: 10 };
  h.user.addresses = [...h.user.addresses, { id: "office", label: "Office", line1: "42 Office Road",
    city: "Abuja", lga: "Bwari", state: "Federal Capital Territory", latitude: "9.08", longitude: "7.4",
    postalCode: "FC-02-A09-DB-09", line2: "Use reception", landmark: "Blue building" }];
  await act(async () => { tree = create(<Quotes />); });
  await act(async () => tree.root.findAllByType("Button" as any)
    .find(node => node.props.title === "Edit delivery details")!.props.onPress());
  await act(async () => field("Email").props.onChangeText("  delivery-contact@example.test  "));
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  await act(async () => field("Pickup date · YYYY-MM-DD").props.onChangeText(date));
  h.query = "office";
  await act(async () => tree.update(<Quotes />));
  h.api.mockResolvedValueOnce({ items: [{ id: "rate" }] });
  await act(async () => submit());
  expect(h.api.mock.calls.at(-1)![1].body).toMatchObject({ destination: {
    addressId: "office", address: "42 Office Road, Abuja, Bwari", state: "Federal Capital Territory",
    latitude: 9.08, longitude: 7.4, postalCode: "FC-02-A09-DB-09",
    instructions: "Use reception · Landmark: Blue building", email: "delivery-contact@example.test",
  }, parcel: { pickupDate: date } });
});
it("ignores a late quote response for a superseded saved destination", async () => {
  h.data.order.packageSuggestion = { ...h.data.order.packageSuggestion, length: 20, width: 15, height: 10 };
  let finish!: (value: unknown) => void;
  h.api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => { tree = create(<Quotes />); });
  const oldSubmit = tree.root.findAllByType("Button" as any)
    .find(node => node.props.title === "Continue to delivery options")!.props.onPress;
  let pending!: Promise<void>;
  await act(async () => { pending = oldSubmit(); });
  h.user.addresses = [...h.user.addresses, { ...h.user.addresses[0], id: "new-destination", line1: "42 Newly Selected Street" }];
  h.query = "new-destination";
  await act(async () => tree.update(<Quotes />));
  await act(async () => oldSubmit());
  await act(async () => { finish({ items: [{ id: "old-rate" }] }); await pending; });
  expect(h.api).toHaveBeenCalledOnce();
  expect(h.returnTo).not.toHaveBeenCalled();
  expect(h.reload).not.toHaveBeenCalled();
  expect(tree.root.findAllByType("Button" as any)
    .find(node => node.props.title === "Continue to delivery options")!.props.disabled).toBe(false);
});
it.each(["success", "failure"])("ignores quote %s after leaving review", async outcome => {
  h.data.order.packageSuggestion = { ...h.data.order.packageSuggestion, length: 20, width: 15, height: 10 };
  let finish!: (value: unknown) => void;
  let fail!: (error: Error) => void;
  h.api.mockImplementationOnce(() => new Promise((resolve, reject) => { finish = resolve; fail = reject; }));
  await act(async () => { tree = create(<Quotes />); });
  let pending!: Promise<void>;
  await act(async () => { pending = submit(); });
  await act(async () => tree.unmount());
  await act(async () => {
    if (outcome === "success") finish({ items: [{ id: "rate" }] });
    else fail(new Error("Late provider failure"));
    await pending;
  });
  expect(h.returnTo).not.toHaveBeenCalled();
  expect(h.reload).not.toHaveBeenCalled();
});
it("does not advance a late quote once checkout is locked", async () => {
  h.data.order.packageSuggestion = { ...h.data.order.packageSuggestion, length: 20, width: 15, height: 10 };
  let finish!: (value: unknown) => void;
  h.api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => { tree = create(<Quotes />); });
  let pending!: Promise<void>;
  await act(async () => { pending = submit(); });
  h.data = { ...h.data, order: { ...h.data.order, checkoutActive: true } };
  await act(async () => tree.update(<Quotes />));
  await act(async () => { finish({ items: [{ id: "rate" }] }); await pending; });
  expect(h.returnTo).not.toHaveBeenCalled();
  expect(h.api).toHaveBeenCalledOnce();
});
