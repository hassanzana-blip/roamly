import { resultKind } from "../resultStatus";

describe("resultKind: «ekte priser» krever uttrykkelig bevis fra serveren", () => {
  it("kjent leverandør og sandbox: false er ekte", () => {
    expect(resultKind({ provider: "kayak", sandbox: false })).toBe("live");
    expect(resultKind({ provider: "duffel", sandbox: false })).toBe("live");
    expect(resultKind({ provider: "travelport", sandbox: false })).toBe("live");
  });

  it("demomotor og testmiljø sies rett ut", () => {
    expect(resultKind({ provider: "demo", sandbox: false })).toBe("demo");
    expect(resultKind({ provider: "demo" })).toBe("demo");
    expect(resultKind({ provider: "kayak", sandbox: true })).toBe("sandbox");
    expect(resultKind({ sandbox: true })).toBe("sandbox");
  });

  it("manglende eller ukjente felt gir «ikke bekreftet», aldri «ekte»", () => {
    expect(resultKind({})).toBe("unverified");
    expect(resultKind({ provider: "kayak" })).toBe("unverified");
    expect(resultKind({ sandbox: false })).toBe("unverified");
    expect(resultKind({ provider: "somethingnew" as never, sandbox: false })).toBe("unverified");
  });
});
