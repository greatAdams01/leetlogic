import React, { useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const h = vi.hoisted(() => ({
  available: vi.fn(),
  permission: vi.fn(),
  speak: vi.fn(),
  listen: vi.fn(),
  stop: vi.fn(),
  changed: vi.fn(),
  done: vi.fn(),
  activity: vi.fn(),
  background: undefined as undefined | ((state: string) => void),
}));
vi.mock("react-native", () => ({
  View: "View",
  Linking: { openSettings: vi.fn() },
  AppState: {
    addEventListener: (_event: string, cb: (state: string) => void) => {
      h.background = cb;
      return { remove: vi.fn() };
    },
  },
}));
vi.mock("./local-listing-speech", () => ({
  serverVoiceEnabled: false,
  finishListingAnswer: vi.fn(),
  localSpeechAvailable: h.available,
  requestLocalSpeechPermission: h.permission,
  speakListing: h.speak,
  listenListing: h.listen,
  stopListingSpeech: h.stop,
  speechSetupMessage:
    "Voice listing is unavailable right now. You can continue by typing. Your saved answers will be kept.",
}));
vi.mock("../components/app-sheet", async () => {
  const { createElement } = await import("react");
  return {
    AppSheet: ({ children, footer, ...props }: any) =>
      createElement("AppSheet", props, children, footer),
  };
});
vi.mock("../components/ui", async () => {
  const { createElement } = await import("react");
  return Object.fromEntries(
    ["Button", "Field", "Label", "Notice"].map((name) => [
      name,
      ({ children, ...props }: any) => createElement(name, props, children),
    ]),
  );
});
import { GuidedListing } from "../components/guided-listing";
import { emptyListing, type ListingForm } from "./listing-form";
const catalogue = {
  categories: [
    {
      id: "roots",
      slug: "roots-tubers",
      translations: [{ locale: "en", name: "Roots and tubers" }],
    },
  ],
  units: [{ code: "PIECE", allowsDecimal: false }],
  commissionBasisPoints: 600,
  addresses: [
    { id: "farm", line1: "Farm road", city: "Enugu", lga: "Enugu North", state: "Enugu" },
  ],
};
let renderer: ReactTestRenderer;
function Harness({ initial = emptyListing }: { initial?: ListingForm }) {
  const [form, setForm] = useState(initial);
  return (
    <GuidedListing
      visible
      form={form}
      catalogue={catalogue}
      onChange={(value) => {
        h.changed(value);
        setForm(value);
      }}
      onClose={vi.fn()}
      onDone={h.done}
      onActivityChange={h.activity}
    />
  );
}
const buttons = () => renderer.root.findAllByType("Button" as never);
const button = (title: string) => buttons().find((b) => b.props.title === title)!;
beforeEach(() => {
  vi.clearAllMocks();
  h.available.mockResolvedValue("en-NG");
  h.permission.mockResolvedValue(undefined);
  h.speak.mockResolvedValue(undefined);
  h.stop.mockResolvedValue(undefined);
  h.listen.mockImplementation(() => new Promise(() => {}));
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
const edit = async (value: string) => {
  await act(async () => renderer.root.findByType("Field" as never).props.onChangeText(value));
};
const tap = async (title: string) => { await act(async () => button(title).props.onPress()); };
const saved = () => h.changed.mock.calls.at(-1)?.[0];
const stockForm: ListingForm = {
  ...emptyListing, title: "Yam", description: "Fresh yam", categoryId: "roots",
  unitCode: "PIECE", salePackaging: { type: "PIECE", size: 1, measure: "PIECE" },
  addressId: "farm", packingAssistanceRequested: true,
};
it("automatically reads each question and its choices without repeating while typing", async () => {
  await act(async () => { renderer = create(<Harness />); });
  expect(h.speak).toHaveBeenCalledOnce();
  expect(h.speak.mock.calls[0]![0]).toContain("What produce");
  expect(button("Read aloud")).toBeUndefined();
  await edit("Yam");
  expect(h.speak).toHaveBeenCalledOnce();
  await tap("Continue");
  expect(h.speak).toHaveBeenCalledTimes(2);
  expect(h.speak.mock.calls[1]![0]).toContain("Roots and tubers");
  expect(h.permission).not.toHaveBeenCalled();
  expect(h.listen).not.toHaveBeenCalled();
});
it("keeps typing available if automatic speech fails", async () => {
  h.speak.mockRejectedValueOnce(new Error("speaker unavailable"));
  await act(async () => { renderer = create(<Harness />); });
  expect(JSON.stringify(renderer.toJSON())).toContain("Could not read this question aloud");
  await edit("Yam"); await tap("Continue");
  expect(saved().title).toBe("Yam");
});
it("completes a hybrid listing without starting speech or asking spoken yes/no", async () => {
  await act(async () => { renderer = create(<Harness />); });
  await edit("Yam"); await tap("Continue");
  await tap("Roots and tubers");
  await edit("Fresh white yam"); await tap("Continue");
  await tap("Individual piece / tuber"); await tap("1 PIECE");
  await edit("20"); await tap("Continue");
  await edit("500"); await tap("Continue");
  await tap("Farm road, Enugu, Enugu"); await tap("Within my state");
  await tap("Ask for packing assistance");
  expect(saved()).toMatchObject({ quantity: "20", price: "500", shippingScope: "LOCAL", packingAssistanceRequested: true });
  expect(h.listen).not.toHaveBeenCalled(); expect(h.permission).not.toHaveBeenCalled();
  expect(JSON.stringify(renderer.toJSON())).toContain("estimated earnings before submitting");
  expect(h.done).not.toHaveBeenCalled();
  await tap("Continue to photos and review"); expect(h.done).toHaveBeenCalledOnce();
});
it("lets the farmer edit a transcribed amount before tapping Continue", async () => {
  h.listen.mockResolvedValueOnce("five");
  await act(async () => { renderer = create(<Harness initial={stockForm} />); });
  await tap("Answer by voice");
  expect(h.changed).not.toHaveBeenCalled();
  expect(renderer.root.findByType("Field" as never).props.value).toBe("5");
  await edit("20"); await tap("Continue");
  expect(saved().quantity).toBe("20"); expect(h.listen).toHaveBeenCalledOnce();
});
it("keeps unclear speech editable without restarting or guessing a quantity", async () => {
  h.listen.mockResolvedValueOnce("one or two");
  await act(async () => { renderer = create(<Harness initial={stockForm} />); });
  await tap("Answer by voice");
  expect(h.changed).not.toHaveBeenCalled(); expect(button("Continue").props.disabled).toBe(true);
  await edit("20"); await tap("Continue"); expect(saved().quantity).toBe("20");
});
it("supports typing when the speech service is unavailable", async () => {
  h.available.mockRejectedValueOnce(new Error("Voice service unavailable"));
  await act(async () => { renderer = create(<Harness initial={stockForm} />); });
  await tap("Answer by voice");
  expect(JSON.stringify(renderer.toJSON())).toContain("Voice service unavailable");
  await edit("20"); await tap("Continue"); expect(saved().quantity).toBe("20");
});
it("continues recording after a permission dialog makes iOS inactive", async () => {
  h.permission.mockImplementationOnce(async () => { h.background!("inactive"); });
  h.listen.mockResolvedValueOnce("twenty");
  await act(async () => { renderer = create(<Harness initial={stockForm} />); });
  await tap("Answer by voice");
  expect(renderer.root.findByType("Field" as never).props.value).toBe("20");
});
it("ignores a late transcription after backgrounding", async () => {
  let resolve!: (value: string) => void;
  h.listen.mockImplementationOnce(() => new Promise<string>(done => { resolve = done; }));
  await act(async () => { renderer = create(<Harness initial={stockForm} />); });
  await tap("Answer by voice");
  await act(async () => h.background!("background"));
  await act(async () => resolve("twenty"));
  expect(renderer.root.findByType("Field" as never).props.value).toBe("");
  expect(h.changed).not.toHaveBeenCalled();
});
it("does not save invalid stock or price", async () => {
  await act(async () => { renderer = create(<Harness initial={stockForm} />); });
  await edit("1.5"); expect(button("Continue").props.disabled).toBe(true);
  await edit("20"); await tap("Continue");
  await edit("0"); expect(button("Continue").props.disabled).toBe(true);
  expect(saved().price).toBe("");
});
