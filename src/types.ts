export type FacilityType = "zoo" | "aquarium" | "both" | "other";
export interface Facility { id:string; name:string; kana:string; pref:string; city:string; type:FacilityType; lat:number; lng:number; url:string; sourceUrls:string[]; status:"open"|"closed"|"suspended"; lastVerifiedAt:string }
