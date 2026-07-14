import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AuthGate from "./AuthGate";
import { db, firebaseAuthClient, HOUSEHOLD_UID, storage } from "./firebase";
import { FirebaseVisitPhotoStore } from "./visitPhotos";
import { FirestoreCustomFacilityStore } from "./customFacilities";
import { FirestoreMarkStore } from "./marks";
import { FirestoreVisitStore } from "./visits";
import "./styles.css";

const visitStore = new FirestoreVisitStore(db, HOUSEHOLD_UID);
const photoStore = new FirebaseVisitPhotoStore(storage, HOUSEHOLD_UID);
const markStore = new FirestoreMarkStore(db, HOUSEHOLD_UID);
const customFacilityStore = new FirestoreCustomFacilityStore(db, HOUSEHOLD_UID);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="site-stage">
      <AuthGate client={firebaseAuthClient}>
        {(controls) => (
          <App
            visitStore={visitStore}
            photoStore={photoStore}
            markStore={markStore}
            customFacilityStore={customFacilityStore}
            {...controls}
          />
        )}
      </AuthGate>
    </div>
  </StrictMode>,
);
