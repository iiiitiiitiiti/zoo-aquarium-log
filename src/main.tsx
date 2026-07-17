import { registerSW } from "virtual:pwa-register";
import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AuthGate, { type AuthSessionControls } from "./AuthGate";
import { db, firebaseAuthClient, storage } from "./firebase";
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

function AuthenticatedApp({ uid, controls }: { uid: string; controls: AuthSessionControls }) {
  const stores = useMemo(() => ({
    visitStore: new FirestoreVisitStore(db, uid),
    photoStore: new FirebaseVisitPhotoStore(storage, uid),
    markStore: new FirestoreMarkStore(db, uid),
    customFacilityStore: new FirestoreCustomFacilityStore(db, uid),
    facilityNoteStore: new FirestoreFacilityNoteStore(db, uid),
  }), [uid]);

  return <App {...stores} {...controls} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="site-stage">
      <AuthGate client={firebaseAuthClient}>
        {(controls) => (
          <AuthenticatedApp key={controls.uid} uid={controls.uid} controls={controls} />
        )}
      </AuthGate>
    </div>
  </StrictMode>,
);
