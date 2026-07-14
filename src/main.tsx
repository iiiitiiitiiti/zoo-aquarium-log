import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AuthGate from "./AuthGate";
import { db, firebaseAuthClient, HOUSEHOLD_UID, storage } from "./firebase";
import { FirebaseVisitPhotoStore } from "./visitPhotos";
import { FirestoreVisitStore } from "./visits";
import "./styles.css";

const visitStore = new FirestoreVisitStore(db, HOUSEHOLD_UID);
const photoStore = new FirebaseVisitPhotoStore(storage, HOUSEHOLD_UID);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="site-stage">
      <AuthGate client={firebaseAuthClient}>
        {(controls) => <App visitStore={visitStore} photoStore={photoStore} {...controls} />}
      </AuthGate>
    </div>
  </StrictMode>,
);
