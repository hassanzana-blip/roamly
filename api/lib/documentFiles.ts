/**
 * Reisedokumenter: hva vi tar imot, og hvordan vi ser hva en fil faktisk er.
 *
 * MIME-typen klienten oppgir er et ønske, ikke et faktum. Vi leser de første
 * bytene og bestemmer typen selv; passer ikke innholdet noen av typene vi
 * tar imot, avvises filen. Grensene her er små nok til at én forespørsel kan
 * holdes i minnet og krypteres synkront.
 */

export const MAX_DOCUMENT_BYTES = 6 * 1024 * 1024;
/** Base64 vokser med 4/3 og litt padding; grensen på råteksten speiler byte-grensen. */
export const MAX_DOCUMENT_BASE64_CHARS = Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4 + 16;
export const MAX_DOCUMENTS_PER_CUSTOMER = 100;

export type DocumentMime = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

export const DOCUMENT_EXTENSIONS: Record<DocumentMime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Sniffer typen fra innholdet. null = ikke en type vi tar imot. */
export function sniffDocumentMime(bytes: Uint8Array): DocumentMime | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return "application/pdf"; // %PDF-
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp"; // RIFF....WEBP
  return null;
}

/**
 * Filnavnet vises til kunden og går inn i Content-Disposition. Vi beholder
 * bokstaver, tall og vanlige tegn, kutter stier og kontrolltegn, og setter
 * riktig filendelse etter den sniffede typen – aldri etter det klienten sa.
 */
export function safeFileName(raw: string, mime: DocumentMime, fallback = "dokument"): string {
  const base = raw
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[A-Za-z0-9]{1,5}$/, "")
    .replace(/[\u0000-\u001f\u007f"';<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${base || fallback}.${DOCUMENT_EXTENSIONS[mime]}`;
}

/** Content-Disposition med både ASCII-fallback og UTF-8-navn (RFC 5987). */
export function contentDisposition(fileName: string, inline: boolean): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function documentBytesOk(bytes: number): boolean {
  return Number.isInteger(bytes) && bytes > 0 && bytes <= MAX_DOCUMENT_BYTES;
}
