#!/usr/bin/env node
// Download generated editorial photography into public/photos.
// Run locally: node scripts/fetch-photos.mjs
// The sandbox that produced these could not reach the Higgsfield CDN, so the
// files are fetched here instead of being committed as binaries by the agent.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const CDN = "https://d8j0ntlcm91z4.cloudfront.net/user_3Gtf2xJh6TlUwOwR0inqII7wr1E/";
const PHOTOS = [
  ["arrivals-reunion-osl", "hf_20260907_123508_2a9cb25e-7402-4a78-afb3-1473d411ee6b"],
  ["gate-family-itinerary", "hf_20260907_123508_0449685e-3ef3-4342-8dd2-cfdec0fbc720"],
  ["rental-car-luggage", "hf_20260907_123509_1d592a67-9d7d-47af-a387-2afa9e51b082"],
  ["hotel-arrival-couple", "hf_20260907_123508_eb44daa1-65ad-4c6c-a389-efb61270aca4"],
  ["checkin-family-stroller", "hf_20260907_123508_4e583b88-840c-43f0-a31b-23fa8ed30f9e"],
  ["gate-solo-dawn", "hf_20260907_123508_bb5a0a73-d443-482c-878b-572aa8152a12"],
  ["arrivals-reunion-ebl", "hf_20260907_123509_51df3e6e-f748-4505-95d9-262ff93b5c43"],
  ["luggage-lineup", "hf_20260907_123508_522e7354-cd3b-408c-8a49-e21cf9098790"],
  ["asmara-harnet-avenue", "hf_20260907_123509_d8147813-3ae6-4dcb-a99e-e4abe0b650ae"],
];

const out = path.resolve("public/photos/generated");
mkdirSync(out, { recursive: true });
for (const [name, id] of PHOTOS) {
  const target = path.join(out, `${name}.png`);
  if (existsSync(target)) {
    console.log("skip", name);
    continue;
  }
  const res = await fetch(`${CDN}${id}.png`);
  if (!res.ok) {
    console.error("failed", name, res.status);
    continue;
  }
  writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  console.log("saved", target);
}
console.log("Review every file before use: reject anything that looks generated, then convert to JPEG/WebP at 1600px and 800px.");
