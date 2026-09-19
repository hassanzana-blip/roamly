import { useCallback, useEffect, useMemo, useState } from "react";
import { destinationById, DESTINATIONS } from "@/content/discover";

/**
 * Saved collections («Lagret samling»): the flights and hotels a person has
 * bookmarked while planning a trip, grouped by destination, with a note and
 * the dates of the trip.
 *
 * Storage is this browser's localStorage only. Nothing here syncs across
 * devices or to an account, and the UI says so («Lagret i denne
 * nettleseren»). A saved item keeps the price it had when it was saved, the
 * provider that quoted it and a link back to the live search, so the person
 * can always check the current price – we never present the saved price as
 * still valid.
 */

export type SavedFlight = {
  kind: "flight";
  id: string;
  offerId: string;
  from: string;
  to: string;
  fromCity: string;
  toCity: string;
  depart: string;
  ret?: string;
  /** Marketing carrier of the first leg, e.g. «Norwegian». */
  airline: string;
  airlineIata: string;
  /** Who sells it (external booking) – may equal the airline. */
  provider: string;
  priceMinor: number;
  currency: string;
  /** Total for this many travellers. */
  travellers: number;
  /** `/sok?…` — the live search to check the price again. */
  searchHref: string;
  savedAt: number;
};

export type SavedHotel = {
  kind: "hotel";
  id: string;
  hotelKey: string;
  name: string;
  place: string;
  countryCode?: string;
  checkin: string;
  checkout: string;
  nights: number;
  adults: number;
  rooms: number;
  image?: string;
  provider: string;
  priceAmount: number;
  currency: string;
  /** `/hotell/:key?…` — the detail page with live rates. */
  href: string;
  /** Sandbox / test data at the time of saving. */
  sandbox?: boolean;
  savedAt: number;
};

export type SavedItem = SavedFlight | SavedHotel;

export type Collection = {
  id: string;
  title: string;
  /** The destination this collection is about (city name), used for the photo and the default title. */
  city: string;
  /** Destination registry id when we have a photograph of the place. */
  destinationId?: string;
  depart?: string;
  ret?: string;
  adults: number;
  note: string;
  items: SavedItem[];
  createdAt: number;
  updatedAt: number;
};

const KEY = "hellosky:collections";
const EVENT = "hellosky:collections";

function read(): Collection[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((c) => c && typeof c.id === "string" && Array.isArray(c.items)) : [];
  } catch {
    return [];
  }
}

function write(list: Collection[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private mode – state lives in memory only */
  }
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* tests */
  }
}

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

const norm = (s: string) => s.trim().toLocaleLowerCase("nb-NO");

/** The destination photo for a city, when the registry has one. */
export function destinationForCity(city: string, iata?: string) {
  return DESTINATIONS.find((d) => (iata && d.iata === iata) || norm(d.city) === norm(city)) ?? undefined;
}

/** Finds (or creates) the collection for a city; the newest collection for that city wins. */
function collectionFor(list: Collection[], city: string, iata: string | undefined, dates: { depart?: string; ret?: string; adults?: number }, defaultTitle: (city: string) => string): Collection {
  const existing = list.find((c) => norm(c.city) === norm(city));
  if (existing) return existing;
  const dest = destinationForCity(city, iata);
  const now = Date.now();
  const c: Collection = {
    id: uid(),
    title: defaultTitle(dest?.city ?? city),
    city: dest?.city ?? city,
    destinationId: dest?.id,
    depart: dates.depart,
    ret: dates.ret,
    adults: dates.adults ?? 1,
    note: "",
    items: [],
    createdAt: now,
    updatedAt: now,
  };
  list.unshift(c);
  return c;
}

export function loadCollections(): Collection[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function collectionImage(c: Collection): string | undefined {
  const dest = c.destinationId ? destinationById(c.destinationId) : undefined;
  if (dest?.image) return dest.image;
  const hotel = c.items.find((i): i is SavedHotel => i.kind === "hotel" && Boolean(i.image));
  return hotel?.image;
}

/**
 * React binding. Every mutation writes through to storage and notifies other
 * hooks in this tab (custom event) and other tabs (storage event).
 */
export function useCollections(defaultTitle: (city: string) => string) {
  const [list, setList] = useState<Collection[]>(loadCollections);

  useEffect(() => {
    const refresh = () => setList(loadCollections());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY || e.key === null) refresh();
    };
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const mutate = useCallback((fn: (list: Collection[]) => void) => {
    const next = read();
    fn(next);
    write(next);
    setList(next.sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  const touch = (c: Collection) => {
    c.updatedAt = Date.now();
  };

  const saveFlight = useCallback(
    (f: Omit<SavedFlight, "kind" | "id" | "savedAt">): Collection => {
      let target!: Collection;
      mutate((l) => {
        target = collectionFor(l, f.toCity, f.to, { depart: f.depart, ret: f.ret, adults: f.travellers }, defaultTitle);
        if (!target.items.some((i) => i.kind === "flight" && i.offerId === f.offerId)) {
          // Flights first, hotels after – the order of a trip.
          const firstHotel = target.items.findIndex((i) => i.kind === "hotel");
          target.items.splice(firstHotel === -1 ? target.items.length : firstHotel, 0, { ...f, kind: "flight", id: uid(), savedAt: Date.now() });
        }
        if (!target.depart) {
          target.depart = f.depart;
          target.ret = f.ret;
        }
        touch(target);
      });
      return target;
    },
    [mutate, defaultTitle],
  );

  const saveHotel = useCallback(
    (h: Omit<SavedHotel, "kind" | "id" | "savedAt">): Collection => {
      let target!: Collection;
      mutate((l) => {
        target = collectionFor(l, h.place, undefined, { depart: h.checkin, ret: h.checkout, adults: h.adults }, defaultTitle);
        if (!target.items.some((i) => i.kind === "hotel" && i.hotelKey === h.hotelKey)) {
          target.items.push({ ...h, kind: "hotel", id: uid(), savedAt: Date.now() });
        }
        if (!target.depart) target.depart = h.checkin;
        if (!target.ret) target.ret = h.checkout;
        touch(target);
      });
      return target;
    },
    [mutate, defaultTitle],
  );

  const removeItem = useCallback(
    (collectionId: string, itemId: string) =>
      mutate((l) => {
        const c = l.find((x) => x.id === collectionId);
        if (!c) return;
        c.items = c.items.filter((i) => i.id !== itemId);
        touch(c);
      }),
    [mutate],
  );

  const removeCollection = useCallback((collectionId: string) => mutate((l) => l.splice(0, l.length, ...l.filter((c) => c.id !== collectionId))), [mutate]);

  const update = useCallback(
    (collectionId: string, patch: Partial<Pick<Collection, "title" | "note" | "depart" | "ret" | "adults">>) =>
      mutate((l) => {
        const c = l.find((x) => x.id === collectionId);
        if (!c) return;
        Object.assign(c, patch);
        touch(c);
      }),
    [mutate],
  );

  const savedOfferIds = useMemo(() => new Set(list.flatMap((c) => c.items.filter((i): i is SavedFlight => i.kind === "flight").map((i) => i.offerId))), [list]);
  const savedHotelKeys = useMemo(() => new Set(list.flatMap((c) => c.items.filter((i): i is SavedHotel => i.kind === "hotel").map((i) => i.hotelKey))), [list]);

  const unsaveOffer = useCallback(
    (offerId: string) =>
      mutate((l) => {
        for (const c of l) {
          const before = c.items.length;
          c.items = c.items.filter((i) => !(i.kind === "flight" && i.offerId === offerId));
          if (c.items.length !== before) touch(c);
        }
      }),
    [mutate],
  );
  const unsaveHotel = useCallback(
    (hotelKey: string) =>
      mutate((l) => {
        for (const c of l) {
          const before = c.items.length;
          c.items = c.items.filter((i) => !(i.kind === "hotel" && i.hotelKey === hotelKey));
          if (c.items.length !== before) touch(c);
        }
      }),
    [mutate],
  );

  return { collections: list, saveFlight, saveHotel, removeItem, removeCollection, update, savedOfferIds, savedHotelKeys, unsaveOffer, unsaveHotel };
}
