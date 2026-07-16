import { Timestamp } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import {
  groupFacilityNotes,
  normalizeFacilityNoteText,
  type FacilityNoteRecord,
} from "./facilityNotes";

describe("facility note normalization", () => {
  it("groups legacy and new notes by facility in updated order", () => {
    const older = Timestamp.fromMillis(1_000);
    const newer = Timestamp.fromMillis(2_000);
    const records: FacilityNoteRecord[] = [
      { id: "legacy-id", text: "旧メモ", updatedAt: older, createdAt: null },
      { id: "new-id", facilityId: "sapporo_zoo", text: "新メモ", updatedAt: newer, createdAt: newer },
      { id: "legacy-id-2", facilityId: "sapporo_zoo", text: "古い新形式", updatedAt: older, createdAt: older },
    ];

    const notes = groupFacilityNotes(records);

    expect(notes.sapporo_zoo).toEqual([
      expect.objectContaining({ id: "new-id", facilityId: "sapporo_zoo", text: "新メモ" }),
      expect.objectContaining({ id: "legacy-id-2", facilityId: "sapporo_zoo", text: "古い新形式" }),
    ]);
    expect(notes["legacy-id"]).toEqual([
      expect.objectContaining({ id: "legacy-id", facilityId: "legacy-id", text: "旧メモ" }),
    ]);
  });

  it("trims note text and rejects text over 2000 characters", () => {
    expect(normalizeFacilityNoteText("  駐車場メモ  ")).toBe("駐車場メモ");
    expect(normalizeFacilityNoteText("   ")).toBe("");
    expect(() => normalizeFacilityNoteText("a".repeat(2001))).toThrow("2000文字以内");
  });
});
