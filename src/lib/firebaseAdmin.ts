import { cert, getApps, initializeApp, ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let cachedAuth: ReturnType<typeof getAuth> | null = null;
let initialized = false;

function assertNoPublicSecrets() {
  if (
    process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_DHENU_API_KEY
  ) {
    throw new Error("Server secrets must not be exposed via NEXT_PUBLIC_* env vars.");
  }
}

export function ensureFirebaseAdminApp() {
  if (initialized) return;
  assertNoPublicSecrets();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin SDK environment variables");
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey
      } as ServiceAccount)
    });
  }
  initialized = true;
}

export function getFirebaseAdminAuth() {
  if (cachedAuth) return cachedAuth;
  ensureFirebaseAdminApp();
  cachedAuth = getAuth();
  return cachedAuth;
}
