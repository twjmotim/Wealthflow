import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, User, Auth } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, Firestore } from "firebase/firestore";
import { FinancialState, Scenario } from "../types";

// Helper to safely get environment variables in various environments (Vite, Webpack, etc.)
const getEnvVar = (key: string): string | undefined => {
  // 1. Try Vite's import.meta.env (supports both VITE_ prefixed and plain if configured)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    const viteKey = 'VITE_' + key;
    // @ts-ignore
    if (import.meta.env[viteKey]) return import.meta.env[viteKey];
    // @ts-ignore
    if (import.meta.env[key]) return import.meta.env[key];
  }

  // 2. Try standard process.env (Webpack, Next.js, or polyfilled env)
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env) {
    // @ts-ignore
    if (process.env[key]) return process.env[key];
     // @ts-ignore
    if (process.env['REACT_APP_' + key]) return process.env['REACT_APP_' + key];
  }
  
  return undefined;
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

// Initialize Firebase
try {
  const apiKey = getEnvVar('FIREBASE_API_KEY');
  
  if (apiKey) {
    const firebaseConfig = {
      apiKey: apiKey,
      authDomain: getEnvVar('FIREBASE_AUTH_DOMAIN'),
      projectId: getEnvVar('FIREBASE_PROJECT_ID'),
      storageBucket: getEnvVar('FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: getEnvVar('FIREBASE_MESSAGING_SENDER_ID'),
      appId: getEnvVar('FIREBASE_APP_ID')
    };

    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase initialized successfully");
  } else {
    console.warn("Firebase configuration missing. Check your .env file.");
  }
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

export const getFirebaseServices = () => ({ app, auth, db });

export const loginWithGoogle = async () => {
  if (!auth) {
    alert("系統尚未偵測到 Firebase 設定。\n\n請檢查您的 .env 檔案是否包含 'FIREBASE_API_KEY' 等變數。\n如果您使用的是 Vite，變數名稱可能需要加上 'VITE_' 前綴 (例如: VITE_FIREBASE_API_KEY)。");
    return;
  }
  const provider = new GoogleAuthProvider();
  try {
    return await signInWithPopup(auth, provider);
  } catch (error: any) {
    console.error("Login failed", error);
    // Throw detailed error to be caught by UI
    throw error;
  }
};

export const logout = async () => {
  if (!auth) return;
  return firebaseSignOut(auth);
};

export const subscribeAuth = (callback: (user: User | null) => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

export const saveUserData = async (uid: string, data: { financials: FinancialState; scenarios: Scenario[] }) => {
  if (!db) return;
  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, data, { merge: true });
  } catch (e) {
    console.error("Error saving data:", e);
    throw e;
  }
};

export const loadUserData = async (uid: string) => {
  if (!db) return null;
  try {
    const userRef = doc(db, "users", uid);
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
      return snapshot.data() as { financials: FinancialState; scenarios: Scenario[] };
    }
  } catch (e) {
    console.error("Error loading data:", e);
  }
  return null;
};