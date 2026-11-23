// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("./customer-api", () => ({ customerApi: h.api }));
vi.mock("../components/language-provider", () => ({ useLanguage: () => ({ locale: "en" }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: any) => <a href={href}>{children}</a> }));
import { CustomerOrders } from "../components/customer-orders";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("searches with the selected filter and loads the next server page", async () => {
  h.api.mockImplementation(async (path: string) => ({ items: [{ id: path.includes("cursor=") ? "second" : "first", reference: "ORDER-123", listing: { title: path.includes("cursor=") ? "Beans" : "Rice" }, totalMinor: "10000", status: "FUNDED", sellerName: "Benue Farmer" }], nextCursor: path.includes("cursor=") ? null : "first" }));
  render(<CustomerOrders />); await screen.findByText("Rice");
  fireEvent.change(screen.getByLabelText("Search orders"), { target: { value: "Benue" } });
  fireEvent.click(screen.getByRole("button", { name: "Active" }));
  await waitFor(() => expect(h.api.mock.calls.at(-1)![0]).toContain("filter=ACTIVE&q=Benue"));
  await screen.findByText("Rice");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Load more orders" })));
  expect(screen.getByText("Beans")).toBeTruthy(); expect(screen.getByText("Rice")).toBeTruthy();
  expect(h.api.mock.calls.at(-1)![0]).toContain("cursor=first");
});
it("shows a clear empty state without leaking previous results", async () => {
  h.api.mockResolvedValue({ items: [], nextCursor: null });
  render(<CustomerOrders />); await screen.findByText("No orders match your search and filters.");
  expect(screen.queryByRole("button", { name: "Load more orders" })).toBeNull();
});

it("refreshes a saved admin decision on focus without clearing the current order", async () => {
  const row = { id: "first", reference: "ORDER-123", listing: { title: "Rice" }, totalMinor: "10000", status: "FUNDED", fulfillmentStatus: "Preparing" };
  h.api.mockResolvedValueOnce({ items: [row] });
  render(<CustomerOrders />);
  await screen.findByText(/Preparing/);
  let resolve!: (page: object) => void;
  h.api.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  expect(screen.getByText("Rice")).toBeTruthy();
  expect(screen.queryByText("Loading orders…")).toBeNull();
  await act(async () => resolve({ items: [{ ...row, status: "COMPLETED", fulfillmentStatus: "Completed by administrator" }] }));
  expect(screen.getByText(/Completed by administrator/)).toBeTruthy();
});
