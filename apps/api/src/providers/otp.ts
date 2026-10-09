import { logger } from "../lib/logger.js";
import { getConfig } from "../config.js";

export interface OtpProvider { readonly name: "CONSOLE" | "TERMII" | "AFRICAS_TALKING"; send(phone: string, code: string): Promise<void> }
export class ConsoleOtpProvider implements OtpProvider { readonly name = "CONSOLE" as const; async send(phone: string, code: string) { if (getConfig().NODE_ENV === "production") throw new Error("Console OTP provider is development-only"); logger.info({ phone, code }, "Development OTP — use this code to verify"); } }
export class TermiiOtpProvider implements OtpProvider {
  readonly name = "TERMII" as const;
  async send(phone: string, code: string) {
    const config = getConfig(); if (!config.TERMII_API_KEY) throw new Error("Termii is not configured");
    const response = await fetch("https://api.ng.termii.com/api/sms/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ api_key: config.TERMII_API_KEY, to: phone, from: config.TERMII_SENDER_ID, sms: `Your Leetlogic verification code is ${code}. It expires in 5 minutes.`, type: "plain", channel: "generic" }) });
    if (!response.ok) throw new Error(`Termii failed with ${response.status}`);
  }
}
export class AfricasTalkingOtpProvider implements OtpProvider {
  readonly name = "AFRICAS_TALKING" as const;
  async send(phone: string, code: string) {
    const config = getConfig(); if (!config.AFRICAS_TALKING_API_KEY || !config.AFRICAS_TALKING_USERNAME) throw new Error("Africa's Talking is not configured");
    const body = new URLSearchParams({ username: config.AFRICAS_TALKING_USERNAME, to: phone, message: `Your Leetlogic verification code is ${code}. It expires in 5 minutes.`, from: config.AFRICAS_TALKING_SENDER_ID });
    const response = await fetch("https://api.africastalking.com/version1/messaging", { method: "POST", headers: { "apiKey": config.AFRICAS_TALKING_API_KEY, "content-type": "application/x-www-form-urlencoded" }, body });
    if (!response.ok) throw new Error(`Africa's Talking failed with ${response.status}`);
  }
}
export function otpProviders(): OtpProvider[] { const config = getConfig(); return config.OTP_PROVIDER === "console" ? [new ConsoleOtpProvider()] : [new TermiiOtpProvider(), new AfricasTalkingOtpProvider()]; }

