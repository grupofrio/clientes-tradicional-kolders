import { jwtVerify, SignJWT } from "jose";
import { createHash } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET;

function getSecretKey() {
  if (!JWT_SECRET) {
    return null;
  }

  return new TextEncoder().encode(JWT_SECRET);
}

export async function signToken(payload: any, expiresIn: string = "7d") {
  const secretKey = getSecretKey();
  if (!secretKey) {
    throw new Error("JWT_SECRET environment variable is not set.");
  }

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

export async function verifyToken(token: string) {
  const secretKey = getSecretKey();
  if (!secretKey) {
    return null;
  }

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
