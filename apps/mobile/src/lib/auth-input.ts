export function otpDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}
export function maskedPhone(value: string) {
  const prefix = value.startsWith("+234") ? value.slice(0, 6) : value.slice(0, 3);
  return `${prefix}****`;
}
export function resendSeconds(deadline: number, now = Date.now()) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function phoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}
export function phoneInputError(value: string): string | undefined {
  if (!value) return "Enter your phone number.";
  if (value.startsWith("0") && value.length !== 11)
    return "Enter all 11 digits of your phone number.";
  if (!value.startsWith("0") && value.length !== 10)
    return "Enter 10 digits without the starting 0, or 11 digits with it.";
}
