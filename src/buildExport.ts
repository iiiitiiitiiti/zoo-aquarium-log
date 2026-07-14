import type { Facility } from "./types";
import type { MarkMap } from "./marks";
import type { Visit } from "./visits";

export const EXPORT_SCHEMA_VERSION = 1 as const;

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

export interface ExportData {
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  counts: {
    visits: number;
    marks: number;
    customFacilities: number;
  };
  visits: ExportVisit[];
  marks: ExportMark[];
  customFacilities: Facility[];
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

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    counts: {
      visits: sortedVisits.length,
      marks: sortedMarks.length,
      customFacilities: sortedCustomFacilities.length,
    },
    visits: sortedVisits,
    marks: sortedMarks,
    customFacilities: sortedCustomFacilities,
  };
}

export function buildExportFilename(now = new Date()) {
  return `zoo-aquarium-log-${localDateString(now)}.json`;
}
