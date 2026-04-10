import { createHash, createHmac } from "crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function hmacSha256(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input, "utf8").digest("hex");
}

export function secureCompare(a: string, b: string): boolean {
  return sha256(a) === sha256(b);
}
