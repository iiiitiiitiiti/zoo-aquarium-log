import type { Facility } from "./types";
import type { FacilityNoteMap } from "./facilityNotes";
import type { MarkMap } from "./marks";
import type { Visit } from "./visits";

export const EXPORT_SCHEMA_VERSION = 3 as const;

export interface ExportVisit {
  id: string;
  facilityId: string;
  date: string;
  rating?: number;
  memo?: string;
  visitor?: string;
  photoPath?: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ExportMark {
  facilityId: string;
  wishlist: boolean;
  favorite: boolean;
}

export interface ExportFacilityNote {
  id: string;
  facilityId: string;
  text: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ExportData {
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  counts: {
    visits: number;
    marks: number;
    customFacilities: number;
    facilityNotes: number;
  };
  visits: ExportVisit[];
  marks: ExportMark[];
  customFacilities: Facility[];
  facilityNotes: ExportFacilityNote[];
}

interface TimestampLike {
  toDate(): Date;
}

function timestampToIso(timestamp: TimestampLike | null | undefined) {
  return timestamp?.toDate().toISOString() ?? null;
}

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildExport(
  visits: Visit[],
  marks: MarkMap,
  customFacilities: Facility[],
  facilityNotes: FacilityNoteMap,
  now = new Date(),
): ExportData {
  const sortedVisits = [...visits]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .map((visit) => ({
      id: visit.id,
      facilityId: visit.facilityId,
      date: visit.date,
      ...(visit.rating === undefined ? {} : { rating: visit.rating }),
      ...(visit.memo === undefined ? {} : { memo: visit.memo }),
      ...(visit.visitor === undefined ? {} : { visitor: visit.visitor }),
      ...(visit.photoPath === undefined ? {} : { photoPath: visit.photoPath }),
      createdAt: timestampToIso(visit.createdAt),
      updatedAt: timestampToIso(visit.updatedAt),
    }));
  const sortedMarks = Object.entries(marks)
    .sort(([facilityIdA], [facilityIdB]) => facilityIdA.localeCompare(facilityIdB))
    .map(([facilityId, mark]) => ({
      facilityId,
      wishlist: mark.wishlist === true,
      favorite: mark.favorite === true,
    }));
  const sortedCustomFacilities = [...customFacilities]
    .sort((a, b) => a.id.localeCompare(b.id));
  // v1/v2 backups should be read as facilityNotes=[] when import support is added;
  // counts are informational and should be recalculated from the arrays.
  const sortedFacilityNotes = Object.values(facilityNotes)
    .flat()
    .sort((a, b) => {
      const facilityOrder = a.facilityId.localeCompare(b.facilityId);
      if (facilityOrder !== 0) return facilityOrder;
      const updatedA = a.updatedAt?.toMillis() ?? 0;
      const updatedB = b.updatedAt?.toMillis() ?? 0;
      return updatedB - updatedA || a.id.localeCompare(b.id);
    })
    .map((note) => ({
      id: note.id,
      facilityId: note.facilityId,
      text: note.text,
      createdAt: timestampToIso(note.createdAt),
      updatedAt: timestampToIso(note.updatedAt),
    }));

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    counts: {
      visits: sortedVisits.length,
      marks: sortedMarks.length,
      customFacilities: sortedCustomFacilities.length,
      facilityNotes: sortedFacilityNotes.length,
    },
    visits: sortedVisits,
    marks: sortedMarks,
    customFacilities: sortedCustomFacilities,
    facilityNotes: sortedFacilityNotes,
  };
}

export function buildExportFilename(now = new Date()) {
  return `zoo-aquarium-log-${localDateString(now)}.json`;
}
