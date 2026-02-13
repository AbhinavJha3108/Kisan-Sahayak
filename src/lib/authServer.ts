import { NextRequest } from "next/server";
import { getFirebaseAdminAuth } from "./firebaseAdmin";

export type VerifiedUser = {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
};

function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export async function verifyRequestUser(req: NextRequest): Promise<VerifiedUser | null> {
  const token = extractBearerToken(req);
  if (!token) return null;

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture
    };
  } catch {
    return null;
  }
}
