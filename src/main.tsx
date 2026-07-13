import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AuthGate from "./AuthGate";
import { db, firebaseAuthClient, HOUSEHOLD_UID } from "./firebase";
import { FirestoreVisitStore } from "./visits";
import "./styles.css";

const visitStore = new FirestoreVisitStore(db, HOUSEHOLD_UID);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthGate client={firebaseAuthClient}><App visitStore={visitStore} /></AuthGate>
  </StrictMode>,
);
