export type UpdateServiceWorker = () => Promise<void> | void;

export function createSwUpdateController() {
  let editing = false;
  let updateWaiting = false;
  let updateServiceWorker: UpdateServiceWorker | undefined;

  function applyWhenSafe() {
    if (editing || !updateWaiting || !updateServiceWorker) return;
    updateWaiting = false;
    try {
      void Promise.resolve(updateServiceWorker()).catch(() => { updateWaiting = true; });
    } catch {
      updateWaiting = true;
    }
  }

  return {
    setUpdater(updater: UpdateServiceWorker) {
      updateServiceWorker = updater;
      applyWhenSafe();
    },
    notifyUpdate() {
      updateWaiting = true;
      applyWhenSafe();
    },
    setEditing(nextEditing: boolean) {
      editing = nextEditing;
      applyWhenSafe();
    },
  };
}

export const swUpdate = createSwUpdateController();
