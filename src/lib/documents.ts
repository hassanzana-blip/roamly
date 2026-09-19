import type { I18nKey } from "@/lib/i18n";

/**
 * Klientsiden av dokumentlageret.
 *
 * Filen leses i nettleseren, sendes som base64 til /api/documents/upload og
 * krypteres der før den lagres. Grensene speiler serverens
 * (api/lib/documentFiles.ts): 6 MB, PDF/JPG/PNG/WebP.
 */
export const DOCUMENT_KINDS = ["flight_ticket", "booking_confirmation", "boarding_pass", "hotel_confirmation", "note", "other"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const MAX_DOCUMENT_BYTES = 6 * 1024 * 1024;
export const ACCEPTED_MIMES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";

export function kindLabelKey(kind: DocumentKind): I18nKey {
  return `doc.kind.${kind}` as I18nKey;
}

export type UploadInput = {
  kind: DocumentKind;
  title: string;
  file: File;
  tripPlanId?: number | null;
  travelDate?: string | null;
};

export type UploadResult = { id: number; fileName: string; mime: string; bytes: number; href: string };

export type UploadErrorCode = "TOO_LARGE" | "BAD_TYPE" | "UNAUTHORIZED" | "FAILED";

export class UploadError extends Error {
  code: UploadErrorCode;
  constructor(code: UploadErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new UploadError("FAILED", "read"));
    reader.onload = () => {
      const s = String(reader.result ?? "");
      resolve(s.slice(s.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

/** Sjekker fila lokalt før noe sendes – samme regler som serveren. */
export function validateFile(file: File): UploadError | null {
  if (file.size > MAX_DOCUMENT_BYTES) return new UploadError("TOO_LARGE", "too large");
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const typeOk = (ACCEPTED_MIMES as readonly string[]).includes(file.type) || ["pdf", "jpg", "jpeg", "png", "webp"].includes(ext);
  if (!typeOk) return new UploadError("BAD_TYPE", "bad type");
  return null;
}

export async function uploadDocument(input: UploadInput): Promise<UploadResult> {
  const invalid = validateFile(input.file);
  if (invalid) throw invalid;
  const data = await toBase64(input.file);
  const res = await fetch("/api/documents/upload", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: input.kind, title: input.title, fileName: input.file.name, data, tripPlanId: input.tripPlanId ?? null, travelDate: input.travelDate || null }),
  });
  if (res.status === 401) throw new UploadError("UNAUTHORIZED", "login");
  if (res.status === 413) throw new UploadError("TOO_LARGE", "too large");
  if (res.status === 415) throw new UploadError("BAD_TYPE", "bad type");
  if (!res.ok) throw new UploadError("FAILED", `http ${res.status}`);
  return (await res.json()) as UploadResult;
}
