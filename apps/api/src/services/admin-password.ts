import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function checkPassword(password: string, encoded: string) {
  const [algorithm, salt, expected] = encoded.split(":");
  if (
    algorithm !== "scrypt" ||
    !/^[a-f0-9]{32}$/.test(salt || "") ||
    !/^[a-f0-9]{128}$/.test(expected || "")
  )
    return false;
  const key = (await scrypt(password, salt!, 64)) as Buffer;
  return timingSafeEqual(key, Buffer.from(expected!, "hex"));
}
