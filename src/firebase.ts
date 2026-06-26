import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import configJson from '../firebase-applet-config.json';

const jsonApiKey = configJson.apiKey || '';
const rawApiKey = (import.meta.env.VITE_FIREBASE_API_KEY as string) || jsonApiKey || '';
const hasValidConfig = rawApiKey !== '' && !rawApiKey.includes('DummyKey') && !rawApiKey.includes('dummy');

let app: any = null;
let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let storage: ReturnType<typeof getStorage> | null = null;

if (hasValidConfig) {
  const firebaseConfig = {
    apiKey: rawApiKey,
    authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || configJson.authDomain || '',
    projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || configJson.projectId || '',
    storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || configJson.storageBucket || '',
    messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || configJson.messagingSenderId || '',
    appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || configJson.appId || ''
  };

  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    // Use named database ID if present, else default
    const dbId = (import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID as string) || configJson.firestoreDatabaseId || '';
    if (dbId) {
      db = initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true
      }, dbId);
      console.log(`[Firebase] Initialized with named Firestore Database ID: "${dbId}" (auto-detect long-polling enabled)`);
    } else {
      db = initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true
      });
      console.log(`[Firebase] Initialized with default Firestore Database (auto-detect long-polling enabled)`);
    }
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
      const authPromise = signInAnonymously(auth);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Anonymous Auth timeout (3s)")), 3000);
      });
      const userCredential = await Promise.race([authPromise, timeoutPromise]);
      return userCredential.user;
    }
    return auth.currentUser;
  } catch (error) {
    console.warn("Anonymous auth failed, continuing in public demo mode:", error);
    return null;
  }
}

// Helper to compress base64 image client-side to prevent Firestore document size limit crashes (1MB)
// Scales down images to max 1024px width/height and compresses quality to 70% JPEG
export async function compressImage(dataUrl: string, maxWidth = 1024, maxHeight = 1024, quality = 0.7): Promise<string> {
  if (!dataUrl.startsWith('data:')) {
    return dataUrl;
  }
  
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      try {
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      } catch (err) {
        console.warn("[Image Compression] Canvas toDataURL failed:", err);
        resolve(dataUrl);
      }
    };
    
    img.onerror = () => {
      resolve(dataUrl);
    };
    
    img.src = dataUrl;
  });
}

// Upload a base64 encoded photo data URL to Firebase Storage (Disabled to prevent hanging/timeout)
export async function uploadPhotoToStorage(photoDataUrl: string): Promise<string> {
  // If it's already an http or https URL (e.g. Unsplash preset), return it as is.
  if (photoDataUrl.startsWith('http://') || photoDataUrl.startsWith('https://')) {
    return photoDataUrl;
  }

  console.log("[Firebase Storage] Storage upload bypassed to prevent hanging. Compressing image client-side...");
  return await compressImage(photoDataUrl, 900, 900, 0.6);
}

export { auth, db, storage };
export default app;
