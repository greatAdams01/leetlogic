import { describe, expect, it } from "vitest";
import { isIntroBackGesture, completesIntroBack } from "./intro-gestures";

describe("intro boundary swipe", () => {
  it("returns to language selection only for a one-finger right swipe that starts on the first slide", () => {
    expect(isIntroBackGesture(0, 40, 5, 1)).toBe(true);
    expect(isIntroBackGesture(390, 400, 0, 1)).toBe(false);
    expect(isIntroBackGesture(0, -40, 0, 1)).toBe(false);
    expect(isIntroBackGesture(0, 40, 60, 1)).toBe(false);
    expect(isIntroBackGesture(0, 40, 0, 2)).toBe(false);
    expect(isIntroBackGesture(0, 8, 0, 1)).toBe(false);
  });
  it("completes a deliberate swipe or flick and cancels a short or reversed gesture", () => {
    expect(completesIntroBack(100, 0, 390)).toBe(true);
    expect(completesIntroBack(35, 1, 390)).toBe(true);
    expect(completesIntroBack(35, 0.1, 390)).toBe(false);
    expect(completesIntroBack(12, 1, 390)).toBe(false);
    expect(completesIntroBack(-50, -1, 390)).toBe(false);
  });
});
