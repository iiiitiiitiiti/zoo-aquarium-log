import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import type { AuthClient } from "./AuthGate";

export const HOUSEHOLD_UID = "cbs9TeeZukMBRkHg5iIw9aMXw1W2";
const HOUSEHOLD_EMAIL = "2190agiatotomijuf@gmail.com";

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

export const firebaseAuthClient: AuthClient = {
  onAuthStateChanged(listener) {
    return onAuthStateChanged(auth, (user) => listener(user?.uid === HOUSEHOLD_UID));
  },
  async signIn(password) {
    const credential = await signInWithEmailAndPassword(auth, HOUSEHOLD_EMAIL, password);
    if (credential.user.uid !== HOUSEHOLD_UID) {
      await signOut(auth);
      throw new Error("Unexpected household account");
    }
  },
};
