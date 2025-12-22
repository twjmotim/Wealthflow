import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import { FinancialState, Scenario, SavedAdvice } from "../types";

let app: firebase.app.App | undefined;
let auth: firebase.auth.Auth | undefined;
let db: firebase.firestore.Firestore | undefined;

try {
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

    if (!firebase.apps.length) {
      app = firebase.initializeApp(firebaseConfig);
    } else {
      app = firebase.app();
    }
    auth = firebase.auth();
    db = firebase.firestore();
  }
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

export const loginWithGoogle = async () => {
  if (!auth) return;
  const provider = new firebase.auth.GoogleAuthProvider();
  return await auth.signInWithPopup(provider);
};

export const logout = async () => {
  if (!auth) return;
  return auth.signOut();
};

export const subscribeAuth = (callback: (user: firebase.User | null) => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return auth.onAuthStateChanged(callback);
};

export const saveUserData = async (uid: string, data: { financials: FinancialState; scenarios: Scenario[]; savedAdvices: SavedAdvice[] }) => {
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
      return snapshot.data() as { financials: FinancialState; scenarios: Scenario[]; savedAdvices: SavedAdvice[] };
    }
  } catch (e) {
    console.error("Error loading data:", e);
  }
  return null;
};