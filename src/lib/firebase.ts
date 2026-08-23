import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut,
  type Auth, type User,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * Firebase web config is public by design — it identifies the project, it does
 * not authorise anything. Access is enforced by the Firestore rules in
 * `firestore.rules`, which scope every document to its owner's uid.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Without a project configured the app still runs, storing books in this browser. */
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

function ensureApp(): FirebaseApp {
  if (!isFirebaseConfigured) throw new Error("Firebase is not configured");
  app ??= initializeApp(config);
  return app;
}

export function auth(): Auth {
  authInstance ??= getAuth(ensureApp());
  return authInstance;
}

export function db(): Firestore {
  dbInstance ??= getFirestore(ensureApp());
  return dbInstance;
}

export function watchAuth(cb: (user: User | null) => void): () => void {
  if (!isFirebaseConfigured) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth(), cb);
}

export async function signIn(): Promise<void> {
  await signInWithPopup(auth(), new GoogleAuthProvider());
}

export async function signOutUser(): Promise<void> {
  await signOut(auth());
}

export type { User };
