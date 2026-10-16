import { describe, it, expect } from "vitest";
import { openLanguageScreen, finishLanguageSelection, type Route } from "./navigation";
describe("language navigation", () => {
  it("continues first-time language selection into onboarding", () => {
    expect(finishLanguageSelection([{ name: "language" }])).toEqual([
      { name: "language" },
      { name: "intro" },
    ]);
  });
  it("returns to the exact intro slide after changing language", () => {
    for (let step = 0; step < 3; step++) {
      const opened = openLanguageScreen([{ name: "language" }, { name: "intro" }], step);
      expect(opened.at(-1)?.name).toBe("language");
      expect(finishLanguageSelection(opened).at(-1)).toEqual({ name: "intro", id: String(step) });
    }
  });
  it("returns guests to role selection without replaying onboarding", () => {
    expect(finishLanguageSelection(openLanguageScreen([{ name: "role" }]))).toEqual([
      { name: "role" },
    ]);
  });
  it("returns authenticated users to account settings", () => {
    const history: Route[] = [{ name: "home" }, { name: "profile" }];
    expect(finishLanguageSelection(openLanguageScreen(history))).toEqual(history);
  });
  it("does not stack duplicate language screens or mutate existing history", () => {
    const history: Route[] = [{ name: "intro", id: "1" }];
    const opened = openLanguageScreen(history, 2);
    expect(history).toEqual([{ name: "intro", id: "1" }]);
    expect(openLanguageScreen(opened)).toBe(opened);
  });
});
