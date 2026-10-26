import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
export type SecurityRecord = {
  salt: string;
  hash: string;
  biometric: boolean;
  failures: number;
  retryAt: number;
};
const key = (id: string) => `farmer-security.${id}`;
export async function readSecurity(id: string): Promise<SecurityRecord | null> {
  const value = await SecureStore.getItemAsync(key(id));
  return value ? JSON.parse(value) : null;
}
const digest = (salt: string, pin: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
export async function createSecurity(id: string, pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error("Enter a 4-digit PIN.");
  const salt = Crypto.randomUUID();
  await SecureStore.setItemAsync(
    key(id),
    JSON.stringify({
      salt,
      hash: await digest(salt, pin),
      biometric: false,
      failures: 0,
      retryAt: 0,
    }),
  );
}
export async function enableBiometric(id: string, enabled: boolean) {
  const record = await readSecurity(id);
  if (!record) throw new Error("Create your PIN first.");
  await SecureStore.setItemAsync(key(id), JSON.stringify({ ...record, biometric: enabled }));
}
export async function checkPin(id: string, pin: string) {
  const record = await readSecurity(id);
  if (!record) throw new Error("Sign in again to set up your PIN.");
  if (record.retryAt > Date.now()) throw new Error("Too many attempts. Try again in a minute.");
  const valid = record.hash === (await digest(record.salt, pin));
  const failures = valid ? 0 : record.failures + 1;
  await SecureStore.setItemAsync(
    key(id),
    JSON.stringify({ ...record, failures, retryAt: failures >= 5 ? Date.now() + 60_000 : 0 }),
  );
  if (!valid) throw new Error("That PIN is incorrect. Please try again.");
}
