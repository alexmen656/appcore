import jwt from "jsonwebtoken";

export interface ASCTokenParams {
  issuerId: string;
  keyId: string;
  privateKey: string;
}

export function generateASCToken(params: ASCTokenParams): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: params.issuerId,
      iat: now,
      exp: now + 20 * 60,
      aud: "appstoreconnect-v1",
    },
    params.privateKey,
    {
      algorithm: "ES256",
      header: { alg: "ES256", kid: params.keyId, typ: "JWT" },
    },
  );
}
