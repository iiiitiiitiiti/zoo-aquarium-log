import { registerSW } from "virtual:pwa-register";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AuthGate from "./AuthGate";
import { db, firebaseAuthClient, HOUSEHOLD_UID, storage } from "./firebase";
import { FirestoreCustomFacilityStore } from "./customFacilities";
import { FirestoreFacilityNoteStore } from "./facilityNotes";
import { FirestoreMarkStore } from "./marks";
import { FirebaseVisitPhotoStore } from "./visitPhotos";
import { swUpdate } from "./swUpdate";
import { FirestoreVisitStore } from "./visits";
import "./styles.css";

const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    swUpdate.notifyUpdate();
  },
  onRegisteredSW(swUrl, registration) {
    if (!registration) return;
    window.setInterval(() => {
      if (!navigator.onLine) return;
      fetch(swUrl, { cache: "no-store" })
        .then((response) => response.ok ? registration.update() : undefined)
        .catch(() => undefined);
    }, 60 * 60 * 1000);
  },
});
swUpdate.setUpdater(updateServiceWorker);
const visitStore = new FirestoreVisitStore(db, HOUSEHOLD_UID);
const photoStore = new FirebaseVisitPhotoStore(storage, HOUSEHOLD_UID);
const markStore = new FirestoreMarkStore(db, HOUSEHOLD_UID);
const customFacilityStore = new FirestoreCustomFacilityStore(db, HOUSEHOLD_UID);
const facilityNoteStore = new FirestoreFacilityNoteStore(db, HOUSEHOLD_UID);

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
            facilityNoteStore={facilityNoteStore}
            {...controls}
          />
        )}
      </AuthGate>
    </div>
  </StrictMode>,
);
