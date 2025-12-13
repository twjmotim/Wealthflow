import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import { FinancialState, Scenario } from "../types";

// Types for Firebase v8
// We use the namespaces directly in the code, but for clarity:
type User = firebase.User;
type Auth = firebase.auth.Auth;
type Firestore = firebase.firestore.Firestore;

let app: firebase.app.App | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

// Initialize Firebase
try {
  // Accessing process.env directly so Vite's define plugin can replace them
  const apiKey = process.env.FIREBASE_API_KEY;
  
  if (apiKey) {
    const firebaseConfig = {
      apiKey: apiKey,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID
    };

    // Debug Log (Masking API Key)
    console.log("Initializing Firebase with config:", {
        ...firebaseConfig,
        apiKey: "HIDDEN_IN_LOGS" 
    });

    // Explicit Validation
    const missingKeys = [];
    if (!firebaseConfig.authDomain) missingKeys.push("VITE_FIREBASE_AUTH_DOMAIN");
    if (!firebaseConfig.projectId) missingKeys.push("VITE_FIREBASE_PROJECT_ID");
    
    if (missingKeys.length > 0) {
        alert(`Firebase 設定錯誤：\n\n您的 Vercel 環境變數缺少以下關鍵設定：\n${missingKeys.join('\n')}\n\n請前往 Vercel Settings -> Environment Variables 修正。`);
    }

    if (!firebase.apps.length) {
      app = firebase.initializeApp(firebaseConfig);
    } else {
      app = firebase.app();
    }
    
    auth = firebase.auth();
    db = firebase.firestore();
    console.log("Firebase initialized successfully");
  } else {
    console.warn("Firebase configuration missing. Env vars not found.");
  }
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

export const getFirebaseServices = () => ({ app, auth, db });

export const loginWithGoogle = async () => {
  if (!auth) {
    alert("系統尚未偵測到 Firebase 設定，無法進行登入。\n請檢查 Console Log 確認變數是否正確載入。");
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    return await auth.signInWithPopup(provider);
  } catch (error: any) {
    console.error("Login failed", error);
    if (error.code === 'auth/unauthorized-domain') {
      alert(`登入失敗：網域未授權 (Unauthorized Domain)。\n\n請前往 Firebase Console -> Authentication -> Settings -> Authorized Domains。\n將您的 Vercel 網域 (例如 wealthflow-one.vercel.app) 加入允許清單。`);
    } else if (error.code === 'auth/auth-domain-config-required') {
       alert("登入失敗：缺少 authDomain 設定。\n請檢查 Vercel 環境變數 VITE_FIREBASE_AUTH_DOMAIN 是否已設定。");
    } else {
      alert(`登入失敗 (${error.code}):\n${error.message}`);
    }
    throw error;
  }
};

export const logout = async () => {
  if (!auth) return;
  return auth.signOut();
};

export const subscribeAuth = (callback: (user: User | null) => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return auth.onAuthStateChanged(callback);
};

export const saveUserData = async (uid: string, data: { financials: FinancialState; scenarios: Scenario[] }) => {
  if (!db) return;
  try {
    const userRef = db.collection("users").doc(uid);
    await userRef.set(data, { merge: true });
  } catch (e) {
    console.error("Error saving data:", e);
    throw e;
  }
};

export const loadUserData = async (uid: string) => {
  if (!db) return null;
  try {
    const userRef = db.collection("users").doc(uid);
    const snapshot = await userRef.get();
    if (snapshot.exists) {
      return snapshot.data() as { financials: FinancialState; scenarios: Scenario[] };
    }
  } catch (e) {
    console.error("Error loading data:", e);
  }
  return null;
};