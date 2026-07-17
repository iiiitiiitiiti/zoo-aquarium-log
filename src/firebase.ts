import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import type { AuthClient } from "./AuthGate";

const app = initializeApp({
  apiKey: "AIzaSyByfq88sTzMdLqpiwznMHIuqc9ALwDIXxU",
  authDomain: "zoo-aquarium-log.firebaseapp.com",
  projectId: "zoo-aquarium-log",
  storageBucket: "zoo-aquarium-log.firebasestorage.app",
  messagingSenderId: "822587891838",
  appId: "1:822587891838:web:cec98864225528cab5f82f",
});

const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const firebaseAuthClient: AuthClient = {
  onAuthStateChanged(listener) {
    return onAuthStateChanged(auth, (user) => listener(user?.uid ?? null));
  },
  async signIn(email, password, expectedUid) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    if (credential.user.uid !== expectedUid) {
      await signOut(auth);
      throw new Error("Unexpected household account");
    }
  },
  async signOut() {
    await signOut(auth);
  },
};
