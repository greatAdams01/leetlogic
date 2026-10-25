import { describe, expect, it, vi } from "vitest";
vi.mock("../config.js", () => ({ getConfig: () => ({ BACHS_MODE: "sandbox" }) }));
vi.mock("../providers/payments/bachs.js", () => ({ bachs: { banks: vi.fn() } }));
import { bachs } from "../providers/payments/bachs.js";
import { bankName } from "./bank-names.js";
describe("saved bank names", () => {
  it("resolves missing and old generic names by code and reuses the catalogue", async () => {
    vi.mocked(bachs.banks).mockResolvedValue({ banks: [{ code: "001", name: "Example Bank" }] });
    expect(await bankName("001", "Bank")).toBe("Example Bank");
    expect(await bankName("001")).toBe("Example Bank");
    expect(await bankName("002", "Verified bank name")).toBe("Verified bank name");
    expect(bachs.banks).toHaveBeenCalledTimes(1);
  });
});
