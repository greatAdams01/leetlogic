/** Only take the native pager's gesture when it starts at the first slide's left edge. */
export function isIntroBackGesture(startOffset: number, dx: number, dy: number, touches: number) {
  return startOffset <= 1 && touches === 1 && dx > 14 && dx > Math.abs(dy) * 1.5;
}
export function completesIntroBack(dx: number, velocity: number, width: number) {
  return dx > width * 0.22 || (dx > 24 && velocity > 0.7);
}
