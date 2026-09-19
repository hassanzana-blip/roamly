import { describe, expect, it } from "vitest";
import { contentDisposition, documentBytesOk, MAX_DOCUMENT_BYTES, safeFileName, sniffDocumentMime } from "./documentFiles";

const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(16, 1)]);
const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16, 1)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16, 1)]);
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4, 0), Buffer.from("WEBPVP8 "), Buffer.alloc(8, 1)]);

describe("sniffDocumentMime", () => {
  it("kjenner igjen PDF, JPEG, PNG og WebP på innholdet", () => {
    expect(sniffDocumentMime(pdf)).toBe("application/pdf");
    expect(sniffDocumentMime(jpg)).toBe("image/jpeg");
    expect(sniffDocumentMime(png)).toBe("image/png");
    expect(sniffDocumentMime(webp)).toBe("image/webp");
  });

  it("avviser alt annet – også en HTML-fil som kaller seg PDF", () => {
    expect(sniffDocumentMime(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(sniffDocumentMime(Buffer.from("MZ\u0000\u0000program"))).toBeNull();
    expect(sniffDocumentMime(Buffer.alloc(4))).toBeNull();
  });
});

describe("safeFileName", () => {
  it("fjerner stier og farlige tegn og setter endelsen etter den ekte typen", () => {
    expect(safeFileName("../../etc/passwd.pdf", "application/pdf")).toBe("passwd.pdf");
    expect(safeFileName('Billett "Oslo"; rm -rf.exe', "image/jpeg")).toBe("Billett Oslo rm -rf.jpg");
    expect(safeFileName("", "application/pdf")).toBe("dokument.pdf");
    expect(safeFileName("Hotellbekreftelse København.PNG", "image/png")).toBe("Hotellbekreftelse København.png");
  });
});

describe("contentDisposition", () => {
  it("gir ASCII-fallback og UTF-8-navn", () => {
    const h = contentDisposition("Billett København.pdf", false);
    expect(h.startsWith('attachment; filename="Billett K_benhavn.pdf"')).toBe(true);
    expect(h).toContain("filename*=UTF-8''Billett%20K%C3%B8benhavn.pdf");
    expect(contentDisposition("a.pdf", true).startsWith("inline;")).toBe(true);
  });
});

describe("documentBytesOk", () => {
  it("godtar 1 byte til grensen, ikke over eller null", () => {
    expect(documentBytesOk(1)).toBe(true);
    expect(documentBytesOk(MAX_DOCUMENT_BYTES)).toBe(true);
    expect(documentBytesOk(MAX_DOCUMENT_BYTES + 1)).toBe(false);
    expect(documentBytesOk(0)).toBe(false);
  });
});
