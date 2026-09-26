import { describe, expect, it } from "vitest";
import { mailboxKey, sameMailbox } from "./staffBoundary";
import { readBearerToken, readCustomerToken } from "./customerSessions";

const TOKEN = "AbC_def-0123456789abcdefghijklmnopqrstuvwxy"; // randomToken(32)-form, 43 tegn

function req(headers: Record<string, string>) {
  return new Request("http://localhost/api/trpc/x", { headers });
}

describe("mailboxKey", () => {
  it("normaliserer store bokstaver og mellomrom", () => {
    expect(mailboxKey("  Eier@HelloSky.test ")).toBe("eier@hellosky.test");
  });
  it("fjerner +merkelapp, også med store bokstaver", () => {
    expect(mailboxKey("Eier+Reise@HelloSky.TEST")).toBe("eier@hellosky.test");
  });
  it("tåler rare adresser uten å kaste", () => {
    expect(mailboxKey("+x@hellosky.test")).toBe("+x@hellosky.test");
    expect(mailboxKey("ingen-krøllalfa")).toBe("ingen-krøllalfa");
  });
});

describe("sameMailbox er symmetrisk og uavhengig av store bokstaver", () => {
  it("merkelapp på kundesiden: ansatt eier@ sperrer eier+kunde@", () => {
    expect(sameMailbox("eier@hellosky.test", "eier+kunde@hellosky.test")).toBe(true);
  });
  it("merkelapp på den lagrede ansattadressen: owner+staff@ sperrer owner@", () => {
    expect(sameMailbox("owner+staff@hellosky.test", "owner@hellosky.test")).toBe(true);
    expect(sameMailbox("owner@hellosky.test", "owner+staff@hellosky.test")).toBe(true);
  });
  it("blandede store bokstaver i den lagrede adressen", () => {
    expect(sameMailbox("Owner+Staff@HelloSky.TEST", "owner@hellosky.test")).toBe(true);
    expect(sameMailbox("OWNER@HELLOSKY.TEST", "Owner+x@hellosky.test")).toBe(true);
  });
  it("ulike postkasser er ulike", () => {
    expect(sameMailbox("owner@hellosky.test", "owner2@hellosky.test")).toBe(false);
    expect(sameMailbox("owner@hellosky.test", "owner@hellosky.no")).toBe(false);
  });
});

describe("readCustomerToken", () => {
  it("leser Bearer-tokenet", () => {
    expect(readBearerToken(req({ authorization: `Bearer ${TOKEN}` }))).toBe(TOKEN);
    expect(readCustomerToken(req({ authorization: `bearer ${TOKEN}` }))).toBe(TOKEN);
  });
  it("leser cookien når det ikke er noen Bearer-header", () => {
    expect(readCustomerToken(req({ cookie: `a=1; hellosky_customer=${TOKEN}` }))).toBe(TOKEN);
  });
  it("Bearer med feil form gir ingen sesjon og faller ikke tilbake til cookien", () => {
    expect(readCustomerToken(req({ authorization: "Bearer kort", cookie: `hellosky_customer=${TOKEN}` }))).toBeNull();
    expect(readCustomerToken(req({ authorization: "Bearer ", cookie: `hellosky_customer=${TOKEN}` }))).toBeNull();
    expect(readCustomerToken(req({ authorization: `Bearer ${TOKEN}; drop` }))).toBeNull();
  });
  it("andre skjemaer (Basic) lar cookie-veien være uendret", () => {
    expect(readCustomerToken(req({ authorization: "Basic dXNlcjpwYXNz", cookie: `hellosky_customer=${TOKEN}` }))).toBe(TOKEN);
  });
  it("staff-cookien er aldri en kundesesjon", () => {
    expect(readCustomerToken(req({ cookie: `hellosky_staff=${TOKEN}` }))).toBeNull();
  });
});
