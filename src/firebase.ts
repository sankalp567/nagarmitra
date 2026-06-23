import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const rawApiKey = (import.meta.env.VITE_FIREBASE_API_KEY as string) || '';
const hasValidConfig = rawApiKey !== '' && !rawApiKey.includes('DummyKey') && !rawApiKey.includes('dummy');

let app: any = null;
let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let storage: ReturnType<typeof getStorage> | null = null;

if (hasValidConfig) {
  const firebaseConfig = {
    apiKey: rawApiKey,
    authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || '',
    projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || '',
    storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || '',
    messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || '',
    appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || ''
  };

  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (error) {
    console.warn("Firebase could not initialize with environment config. Running in high-fidelity mock & offline mode.", error);
  }
} else {
  console.log("Firebase not configured with a valid API key. Running in local high-fidelity sandbox & mockup mode.");
}

// Automatically sign in anonymously on load to satisfy 'anonymous auth by default'
export async function ensureAnonymousAuth() {
  if (!auth) return null;
  try {
    if (!auth.currentUser) {
      const userCredential = await signInAnonymously(auth);
      return userCredential.user;
    }
    return auth.currentUser;
  } catch (error) {
    console.warn("Anonymous auth failed, continuing in public demo mode:", error);
    return null;
  }
}

export { auth, db, storage };
export default app;
