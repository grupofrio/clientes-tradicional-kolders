import { jwtVerify, SignJWT } from "jose";
import { createHash } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set. Cannot start application.");
}
const secretKey = new TextEncoder().encode(JWT_SECRET);

export async function signToken(payload: any, expiresIn: string = "7d") {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (error) {
    return null;
  }
}

export function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}
