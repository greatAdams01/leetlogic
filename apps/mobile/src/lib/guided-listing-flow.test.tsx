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
    ["Button", "Label", "Notice"].map((name) => [
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
it("speaks every question, commits only confirmed answers and finishes at photos without submitting", async () => {
  const answers = [
    "I want to sell yam",
    "yes",
    "roots and tubers",
    "yes",
    "Freshly harvested white yam",
    "yes",
    "tubers",
    "yes",
    "twenty",
    "yes",
    "five hundred",
    "yes",
    "one",
    "yes",
    "local",
    "yes",
    "help",
    "yes",
  ];
  h.listen.mockImplementation(() => Promise.resolve(answers.shift()!));
  await act(async () => {
    renderer = create(<Harness />);
  });
  await act(async () => button("Listen and answer").props.onPress());
  expect(h.done).toHaveBeenCalledOnce();
  const final = h.changed.mock.calls.at(-1)![0];
  expect(final).toMatchObject({
    title: "yam",
    categoryId: "roots",
    unitCode: "PIECE",
    quantity: "20",
    price: "500",
    addressId: "farm",
    shippingScope: "LOCAL",
    packingAssistanceRequested: true,
  });
  expect(h.speak.mock.calls.map((c) => c[0]).join(" ")).toContain("Is that correct?");
  expect(h.speak.mock.calls.at(-1)![0]).toContain("Only the submit button");
  expect(h.listen).toHaveBeenCalledTimes(18);
});
it("does not save an unconfirmed answer and lets the farmer replace it", async () => {
  const answers = ["Yam", "no", "Cassava", "yes"];
  h.listen.mockImplementation(() =>
    answers.length ? Promise.resolve(answers.shift()!) : new Promise(() => {}),
  );
  await act(async () => {
    renderer = create(<Harness />);
  });
  await act(async () => button("Listen and answer").props.onPress());
  expect(h.changed.mock.calls.every((c) => c[0].title !== "Yam")).toBe(true);
  expect(h.changed.mock.calls.at(-1)![0]).toMatchObject({
    title: "Cassava",
    voiceCursor: "categoryId",
  });
  await act(async () => button("Pause").props.onPress());
});
it("offers typing without install instructions or permission prompts when voice is unavailable", async () => {
  h.available.mockResolvedValue(null);
  await act(async () => {
    renderer = create(<Harness />);
  });
  await act(async () => button("Listen and answer").props.onPress());
  expect(h.listen).not.toHaveBeenCalled();
  expect(h.changed).not.toHaveBeenCalled();
  expect(h.done).not.toHaveBeenCalled();
  expect(h.permission).not.toHaveBeenCalled();
  expect(button("Continue by typing")).toBeDefined();
  expect(button("Try voice again")).toBeDefined();
  expect(JSON.stringify(renderer.toJSON())).not.toMatch(
    /install|native app build|Open device settings/i,
  );
});
it("ignores late recognition results after backgrounding and retains confirmed values", async () => {
  let resolve!: (text: string) => void;
  h.listen.mockImplementation(
    () =>
      new Promise<string>((r) => {
        resolve = r;
      }),
  );
  await act(async () => {
    renderer = create(
      <Harness
        initial={{
          ...emptyListing,
          title: "Saved yam",
          voiceCursor: "quantity",
          unitCode: "PIECE",
        }}
      />,
    );
  });
  await act(async () => button("Listen and answer").props.onPress());
  await act(async () => h.background!("background"));
  await act(async () => resolve("twenty"));
  expect(h.changed).not.toHaveBeenCalled();
  expect(h.done).not.toHaveBeenCalled();
  expect(h.stop).toHaveBeenCalled();
  expect(button("Listen and answer")).toBeDefined();
});
it("does not advance on an ambiguous quantity", async () => {
  const answers = ["one or two"];
  h.listen.mockImplementation(() =>
    answers.length ? Promise.resolve(answers.shift()!) : new Promise(() => {}),
  );
  await act(async () => {
    renderer = create(
      <Harness initial={{ ...emptyListing, voiceCursor: "quantity", unitCode: "PIECE" }} />,
    );
  });
  await act(async () => button("Listen and answer").props.onPress());
  expect(h.changed).not.toHaveBeenCalled();
  expect(h.speak.mock.calls.some((c) => c[0].includes("could not understand"))).toBe(true);
  await act(async () => button("Pause").props.onPress());
});
