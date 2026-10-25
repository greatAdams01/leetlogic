import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  api: vi.fn(),
  reload: vi.fn().mockResolvedValue(undefined),
  go: vi.fn(),
  alert: vi.fn(),
  openURL: vi.fn().mockResolvedValue(undefined),
  announce: vi.fn(),
  scrollTo: vi.fn(),
  data: {
    enabled: true,
    account: null as null | { ready: boolean; status: string },
    destinations: [] as {
      id: string;
      bankName: string;
      accountLastFour: string;
      usable: boolean;
    }[],
    earnings: { availableMinor: "0", reservedMinor: "0", balanceMinor: "0" },
    heldMinor: "0",
    payoutFeeMinor: "100",
    operations: [] as { id: string; kind: string; status: string; amountMinor: string }[],
  },
}));
vi.mock("react-native", () => ({
  Linking: { openURL: h.openURL },
  ScrollView: "ScrollView",
  Modal: "Modal",
  AppState: { addEventListener: () => ({ remove() {} }) },
  AccessibilityInfo: { announceForAccessibility: h.announce },
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => "withdrawal-key" }));
vi.mock("../state", () => ({
  useApp: () => ({
    user: { profile: { email: "farmer@example.test" }, farmerProfile: { farmName: "Test Farm" } },
    go: h.go,
    alert: h.alert,
    back: vi.fn(),
    error: (error: Error) => error.message,
    ui: (text: string) => text,
    status: (text: string) => text,
  }),
  useResource: () => ({ data: h.data, loading: false, error: "", reload: h.reload }),
}));
vi.mock("./api", () => ({ api: h.api }));
vi.mock("../components/Select", () => ({ Select: "Select" }));
vi.mock("../components/ui", async () => {
  const { createElement } = await import("react");
  const host =
    (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode; scrollRef?: { current: unknown } }) => {
      if (name === "Page" && props.scrollRef) props.scrollRef.current = { scrollTo: h.scrollTo };
      return createElement(name, props, children);
    };
  return Object.fromEntries(
    ["Page", "Card", "Heading", "Label", "Field", "Button", "Notice"].map((name) => [
      name,
      host(name),
    ]),
  );
});
import { Finance } from "../screens/finance";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
let renderer: ReactTestRenderer | undefined;
const button = (title: string) =>
  renderer!.root.findAllByType("Button" as never).find((node) => node.props.title === title)!;
beforeEach(() => {
  vi.clearAllMocks();
  h.data.account = null;
  h.data.destinations = [];
  h.data.operations = [];
  h.data.earnings.availableMinor = "0";
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
    callback();
    return 0;
  });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});
async function mount() {
  await act(async () => {
    renderer = create(<Finance />);
  });
}
async function fill() {
  await act(async () => {
    const fields = renderer!.root.findAllByType("Field" as never);
    fields.find((field) => field.props.label === "First name")!.props.onChangeText("Test");
    fields.find((field) => field.props.label === "Last name")!.props.onChangeText("Farmer");
  });
}
describe("payment setup feedback", () => {
  it("shows a spinner while pending and brings an error into the payment card with an accessibility announcement", async () => {
    let reject!: (error: Error) => void;
    h.api.mockImplementation(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    await mount();
    await fill();
    const setup = renderer!.root
      .findAllByType("Card" as never)
      .find((card) =>
        card
          .findAllByType("Heading" as never)
          .some((heading) => heading.props.children === "Set up payments"),
      )!;
    await act(async () => setup.props.onLayout({ nativeEvent: { layout: { y: 300 } } }));
    await act(async () => button("Set up payments").props.onPress());
    expect(button("Setting up payments…").props.loading).toBe(true);
    expect(button("Setting up payments…").props.disabled).toBe(true);
    await act(async () => reject(new Error("Could not open account setup.")));
    expect(button("Set up payments").props.loading).toBe(false);
    expect(
      setup
        .findAllByType("Notice" as never)
        .some(
          (notice) => notice.props.text === "Could not open account setup." && notice.props.error,
        ),
    ).toBe(true);
    expect(h.scrollTo).toHaveBeenCalledWith({ y: 284, animated: true });
    expect(h.announce).toHaveBeenCalledWith("Could not open account setup.");
    expect(h.reload).toHaveBeenCalledTimes(1);
  });
  it("continues a ready account to banks without opening an unnecessary hosted page", async () => {
    h.data.account = { ready: false, status: "ONBOARDING" };
    h.api.mockResolvedValue({ ready: true, url: null });
    await mount();
    await act(async () => button("Continue payment setup").props.onPress());
    expect(h.go).toHaveBeenCalledWith("banks");
    expect(h.openURL).not.toHaveBeenCalled();
  });
  it("keeps completed setup out of the way and hides technical setup entries from history", async () => {
    h.data.account = { ready: true, status: "READY" };
    h.data.destinations = [
      { id: "bank", bankName: "Test Bank", accountLastFour: "1234", usable: true },
    ];
    h.data.operations = [{ id: "setup", kind: "ACCOUNT", status: "SUCCEEDED", amountMinor: "0" }];
    await mount();
    expect(button("Check payment setup")).toBeUndefined();
    expect(renderer!.root.findAllByType("Field" as never)).toHaveLength(0);
    expect(JSON.stringify(renderer!.toJSON())).not.toContain("SUCCEEDED");
    await act(async () => button("Withdraw earnings").props.onPress());
    expect(
      renderer!.root
        .findAllByType("Field" as never)
        .some((field) => field.props.label === "Amount to receive (NGN)"),
    ).toBe(true);
    expect(renderer!.root.findAllByType("Modal" as never)).toHaveLength(1);
    expect(button("Request withdrawal").props.disabled).toBe(true);
    await act(async () => renderer!.root.findAllByType("Page" as never)[1]!.props.back());
    expect(renderer!.root.findAllByType("Field" as never)).toHaveLength(0);
    await act(async () => button("Manage bank accounts").props.onPress());
    expect(h.go).toHaveBeenCalledWith("banks");
  });
  it("offers only the available amount less fees and closes the modal after a request", async () => {
    h.data.account = { ready: true, status: "READY" };
    h.data.earnings.availableMinor = "10000";
    h.data.destinations = [
      { id: "bank", bankName: "Example Bank", accountLastFour: "1234", usable: true },
    ];
    h.api.mockResolvedValue({ id: "withdrawal" });
    await mount();
    await act(async () => button("Withdraw earnings").props.onPress());
    await act(async () => button("Use full amount").props.onPress());
    expect(renderer!.root.findAllByType("Field" as never)[0]!.props.value).toBe("99.00");
    expect(button("Request withdrawal").props.disabled).toBe(false);
    await act(async () => button("Request withdrawal").props.onPress());
    await act(async () => h.alert.mock.calls[0]![2][1].onPress());
    expect(h.api).toHaveBeenCalledWith(
      "/financial/withdrawals",
      expect.objectContaining({
        body: expect.objectContaining({
          amountMinor: "9900",
          feeMinor: "100",
          destinationId: "bank",
        }),
      }),
    );
    expect(renderer!.root.findAllByType("Modal" as never)).toHaveLength(0);
  });
  it("opens the exact verified sandbox onboarding host", async () => {
    h.data.account = { ready: false, status: "ONBOARDING" };
    h.api.mockResolvedValue({
      ready: false,
      url: "https://sandbox-connect.bachs.io/onboarding/private-link",
    });
    await mount();
    await act(async () => button("Continue payment setup").props.onPress());
    expect(h.openURL).toHaveBeenCalledWith(
      "https://sandbox-connect.bachs.io/onboarding/private-link",
    );
  });
});
