import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

/**
 * Testene kjører uten DOM. Det er nettopp poenget med de to siste: uten
 * `document` finnes ingen reservemetode, og da skal funksjonen svare «nei»
 * i stedet for å kaste – ellers står den som ringer igjen uten svar.
 */

const setClipboard = (impl: unknown) => {
  vi.stubGlobal("navigator", { clipboard: impl });
};

afterEach(() => vi.unstubAllGlobals());

describe("copyText", () => {
  it("bruker utklippstavla når nettleseren tillater det", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    await expect(copyText("QT-1234")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("QT-1234");
  });

  it("svarer nei når skrivingen avvises og ingen reservemetode finnes", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("NotAllowedError")) });
    await expect(copyText("QT-1234")).resolves.toBe(false);
  });

  it("svarer nei når utklippstavla ikke finnes i det hele tatt", async () => {
    setClipboard(undefined);
    await expect(copyText("QT-1234")).resolves.toBe(false);
  });
});
