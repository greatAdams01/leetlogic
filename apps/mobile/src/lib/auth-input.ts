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
