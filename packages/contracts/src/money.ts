/** Minor units stay integers throughout storage and calculations. */
export function formatMoney(value: string | number | bigint | null | undefined = "0"): string {
  const amount = BigInt(value ?? "0");
  const absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? "-" : ""}₦${(absolute / 100n).toLocaleString("en-NG")}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function groupAmount(value: string): string {
  const [whole = "", fraction] = value.split(".");
  return (
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction === undefined ? "" : `.${fraction}`)
  );
}

/** Map a native edit back to an unformatted decimal string and a stable display caret. */
export function editAmount(
  previous: string,
  text: string,
  previousCaret?: number,
  nativeCaret?: number,
) {
  const before = groupAmount(previous);
  let prefix = 0;
  while (prefix < before.length && prefix < text.length && before[prefix] === text[prefix])
    prefix++;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < text.length - prefix &&
    before[before.length - 1 - suffix] === text[text.length - 1 - suffix]
  )
    suffix++;
  let caret =
    nativeCaret ??
    (previousCaret === undefined
      ? text.length - suffix
      : Math.max(0, Math.min(text.length, previousCaret + text.length - before.length)));
  // Backspace/delete at a grouping separator must remove a digit, not trap the caret.
  if (before.length === text.length + 1 && before.slice(prefix, prefix + 1) === ",") {
    const forward = previousCaret === prefix;
    const remove = forward ? prefix : prefix - 1;
    text = text.slice(0, remove) + text.slice(remove + 1);
    caret = Math.max(0, remove);
  }
  const value = text.replaceAll(",", "");
  if (!/^\d{0,10}(\.\d{0,2})?$/.test(value)) return null;
  const meaningful = text.slice(0, caret).replaceAll(",", "").length;
  const display = groupAmount(value);
  let selection = 0,
    seen = 0;
  while (selection < display.length && seen < meaningful) {
    if (display[selection] !== ",") seen++;
    selection++;
  }
  return { value, display, selection };
}
