import { describe, expect, it } from "vitest";
import { emailCandidates } from "./staffBoundary";
import { readBearerToken, readCustomerToken } from "./customerSessions";

const TOKEN = "AbC_def-0123456789abcdefghijklmnopqrstuvwxy"; // randomToken(32)-form, 43 tegn

function req(headers: Record<string, string>) {
  return new Request("http://localhost/api/trpc/x", { headers });
}

describe("emailCandidates", () => {
  it("normaliserer store bokstaver og mellomrom", () => {
    expect(emailCandidates("  Eier@HelloSky.test ")).toEqual(["eier@hellosky.test"]);
  });
  it("tar med adressen uten +merkelapp", () => {
    expect(emailCandidates("eier+reise@hellosky.test")).toEqual(["eier+reise@hellosky.test", "eier@hellosky.test"]);
  });
  it("tåler rare adresser uten å kaste", () => {
    expect(emailCandidates("+x@hellosky.test")).toEqual(["+x@hellosky.test"]);
    expect(emailCandidates("ingen-krøllalfa")).toEqual(["ingen-krøllalfa"]);
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
