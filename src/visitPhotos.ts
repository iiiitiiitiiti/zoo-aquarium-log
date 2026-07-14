import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from "firebase/storage";

const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 0.8;

export interface VisitPhotoStore {
  upload(visitId: string, file: File): Promise<string>;
  getUrl(path: string): Promise<string>;
  remove(path: string): Promise<void>;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("画像を読み込めませんでした"));
    };
    image.src = objectUrl;
  });
}

function compressImage(file: File): Promise<Blob> {
  return loadImage(file).then((image) => {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("画像を処理できませんでした");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("画像を圧縮できませんでした")),
        "image/webp",
        WEBP_QUALITY,
      );
    });
  });
}

export class FirebaseVisitPhotoStore implements VisitPhotoStore {
  constructor(
    private readonly storage: FirebaseStorage,
    private readonly householdUid: string,
  ) {}

  private photoPath(visitId: string) {
    return "households/" + this.householdUid + "/visits/" + visitId + "/photo.webp";
  }

  async upload(visitId: string, file: File) {
    const path = this.photoPath(visitId);
    const photo = await compressImage(file);
    const photoRef = ref(this.storage, path);
    await uploadBytes(photoRef, photo, {
      contentType: "image/webp",
      cacheControl: "public,max-age=31536000,immutable",
    });
    return path;
  }

  getUrl(path: string) {
    return getDownloadURL(ref(this.storage, path));
  }

  async remove(path: string) {
    await deleteObject(ref(this.storage, path));
  }
}