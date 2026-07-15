import { describe, expect, it, vi } from "vitest";
import { createSwUpdateController } from "./swUpdate";

describe("service worker update controller", () => {
  it("applies a waiting update immediately when no editor is open", () => {
    const update = vi.fn();
    const controller = createSwUpdateController();

    controller.setUpdater(update);
    controller.notifyUpdate();

    expect(update).toHaveBeenCalledOnce();
  });

  it("defers a waiting update until the editor closes", () => {
    const update = vi.fn();
    const controller = createSwUpdateController();

    controller.setUpdater(update);
    controller.setEditing(true);
    controller.notifyUpdate();
    expect(update).not.toHaveBeenCalled();

    controller.setEditing(false);

    expect(update).toHaveBeenCalledOnce();
  });

  it("applies an update that arrived before registration once the updater is ready", () => {
    const update = vi.fn();
    const controller = createSwUpdateController();

    controller.notifyUpdate();
    controller.setUpdater(update);

    expect(update).toHaveBeenCalledOnce();
  });
});
