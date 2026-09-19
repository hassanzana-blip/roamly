import { describe, expect, it } from "vitest";
import { MAX_DOCUMENT_BYTES, validateFile } from "./documents";

function fakeFile(name: string, type: string, size: number): File {
  return { name, type, size } as unknown as File;
}

describe("validateFile", () => {
  it("accepts pdf and images within the limit", () => {
    expect(validateFile(fakeFile("billett.pdf", "application/pdf", 1024))).toBeNull();
    expect(validateFile(fakeFile("kort.jpg", "image/jpeg", 1024))).toBeNull();
    expect(validateFile(fakeFile("kort.webp", "", 1024))).toBeNull();
  });
  it("rejects oversized files", () => {
    expect(validateFile(fakeFile("stor.pdf", "application/pdf", MAX_DOCUMENT_BYTES + 1))?.code).toBe("TOO_LARGE");
  });
  it("rejects other types", () => {
    expect(validateFile(fakeFile("virus.exe", "application/octet-stream", 10))?.code).toBe("BAD_TYPE");
    expect(validateFile(fakeFile("side.html", "text/html", 10))?.code).toBe("BAD_TYPE");
  });
});
