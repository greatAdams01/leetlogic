import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  api: vi.fn(),
  reload: vi.fn().mockResolvedValue(undefined),
  go: vi.fn(),
  finance: {
    enabled: true,
    account: { ready: true, status: "READY" },
    destinations: [],
    operations: [],
  },
  result: {
    status: "QUEUED",
    destination: null as null | {
      id: string;
      bankName: string;
      accountName: string;
      accountLastFour: string;
      usable: boolean;
    },
  },
}));
vi.mock("react-native", () => ({ View: "View" }));
vi.mock("../state", () => ({
  useApp: () => ({ back: vi.fn(), go: h.go, error: (error: Error) => error.message }),
  useResource: (path: string, enabled = true) => ({
    loading: false,
    error: "",
    reload: h.reload,
    data: !enabled
      ? null
      : path === "/financial"
        ? h.finance
        : path.includes("operations")
          ? h.result
          : { items: [{ code: "001", name: "Example bank" }] },
  }),
}));
vi.mock("./api", () => ({ api: h.api }));
vi.mock("../components/Select", () => ({ Select: "Select" }));
vi.mock("../components/ui", async () => {
  const { createElement } = await import("react");
  const host =
    (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      createElement(name, props, children);
  return Object.fromEntries(
    ["Page", "Card", "Heading", "Label", "Field", "Button", "Notice"].map((name) => [
      name,
      host(name),
    ]),
  );
});
import { BankAccounts } from "../screens/bank-accounts";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
let renderer: ReactTestRenderer;
const button = (title: string) =>
  renderer.root.findAllByType("Button" as never).find((node) => node.props.title === title)!;
beforeEach(() => {
  vi.clearAllMocks();
  h.finance.account.ready = true;
  h.result.status = "QUEUED";
  h.result.destination = null;
  h.api.mockResolvedValue({ id: "bank-operation" });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
describe("bank account setup", () => {
  it("routes incomplete provider setup before collecting bank details", async () => {
    h.finance.account.ready = false;
    await act(async () => {
      renderer = create(<BankAccounts />);
    });
    expect(button("Add bank account")).toBeUndefined();
    await act(async () => button("Set up payments").props.onPress());
    expect(h.go).toHaveBeenCalledWith("finance");
    expect(h.api).not.toHaveBeenCalled();
  });
  it("requires ten digits and explicit review before submitting, and waits for confirmed verification", async () => {
    await act(async () => {
      renderer = create(<BankAccounts />);
    });
    await act(async () => button("Add bank account").props.onPress());
    await act(async () => {
      renderer.root.findByType("Select" as never).props.onChange("001");
      renderer.root.findByType("Field" as never).props.onChangeText("123456789");
    });
    expect(button("Review bank details").props.disabled).toBe(true);
    await act(async () =>
      renderer.root.findByType("Field" as never).props.onChangeText("123456789012"),
    );
    expect(renderer.root.findByType("Field" as never).props.value).toBe("1234567890");
    await act(async () => button("Review bank details").props.onPress());
    expect(h.api).not.toHaveBeenCalled();
    await act(async () => button("Verify and save bank account").props.onPress());
    expect(h.api).toHaveBeenCalledWith("/financial/banks", {
      method: "POST",
      body: { bankCode: "001", accountNumber: "1234567890" },
    });
    expect(button("Done")).toBeUndefined();
    h.result.status = "SUCCEEDED";
    h.result.destination = {
      id: "bank",
      bankName: "Example bank",
      accountName: "Farmer Name",
      accountLastFour: "7890",
      usable: true,
    };
    await act(async () => renderer.update(<BankAccounts />));
    expect(button("Done")).toBeDefined();
    expect(JSON.stringify(renderer.toJSON())).toContain("Farmer Name");
    expect(JSON.stringify(renderer.toJSON())).not.toContain("1234567890");
    expect(h.api).toHaveBeenCalledTimes(1);
  });
});
