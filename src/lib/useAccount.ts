import { useCallback, useEffect, useMemo, useRef } from "react";
import { trpc, type RouterOutputs } from "@/providers/trpc";
import { useCustomer } from "@/lib/useCustomer";
import { useFavourites } from "@/lib/favourites";

/**
 * Kontoens reiseidentitet på klienten.
 *
 * Alle hooks her er «stille» uten innlogging: de spør ikke serveren og gir
 * tomme svar, slik at sider kan rendres for gjester uten egne grener.
 */

export type TravelProfile = RouterOutputs["account"]["travelProfile"];
export type AccountHub = RouterOutputs["account"]["hub"];
export type SavedItem = RouterOutputs["account"]["saved"][number];

export function useTravelProfile() {
  const { customer } = useCustomer();
  const utils = trpc.useUtils();
  const q = trpc.account.travelProfile.useQuery(undefined, { enabled: Boolean(customer), staleTime: 60_000, retry: false });
  const update = trpc.account.updateTravelProfile.useMutation({
    onSuccess: (data) => {
      utils.account.travelProfile.setData(undefined, data);
      utils.account.hub.invalidate();
    },
  });
  return { profile: q.data ?? null, isLoading: Boolean(customer) && q.isLoading, update };
}

export function useAccountHub() {
  const { customer } = useCustomer();
  return trpc.account.hub.useQuery(undefined, { enabled: Boolean(customer), staleTime: 30_000, retry: false });
}

export function useUnreadCount(): number {
  const { customer } = useCustomer();
  const q = trpc.account.unreadCount.useQuery(undefined, { enabled: Boolean(customer), staleTime: 30_000, refetchInterval: 120_000, retry: false });
  return q.data?.count ?? 0;
}

/**
 * Lagrede reisemål: lokalt for gjester, på kontoen for innloggede. Ved
 * innlogging flettes nettleserens hjerter inn på kontoen én gang, slik at
 * ingen mister det de lagret før de fikk konto.
 */
export function useSavedDestinations(): { ids: Set<string>; toggle: (id: string) => void; isServer: boolean } {
  const { customer } = useCustomer();
  const [localFavs, toggleLocal] = useFavourites();
  const utils = trpc.useUtils();
  const saved = trpc.account.saved.useQuery({ kind: "destination" }, { enabled: Boolean(customer), staleTime: 30_000, retry: false });
  const save = trpc.account.save.useMutation({ onSuccess: () => utils.account.saved.invalidate() });
  const unsave = trpc.account.unsave.useMutation({ onSuccess: () => utils.account.saved.invalidate() });
  const sync = trpc.account.syncSaved.useMutation({ onSuccess: () => utils.account.saved.invalidate() });
  const syncedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!customer || syncedFor.current === customer.id || !saved.isSuccess) return;
    syncedFor.current = customer.id;
    const local = [...localFavs];
    if (local.length) sync.mutate({ destinations: local });
  }, [customer, saved.isSuccess, localFavs, sync]);

  const serverIds = useMemo(() => new Set((saved.data ?? []).map((s) => s.refId)), [saved.data]);
  const ids = useMemo(() => (customer ? new Set([...serverIds, ...localFavs]) : localFavs), [customer, serverIds, localFavs]);

  const toggle = useCallback(
    (id: string) => {
      if (!customer) {
        toggleLocal(id);
        return;
      }
      // Speil lokalt også, så hjertet er riktig med én gang og i neste økt.
      if (ids.has(id)) {
        if (localFavs.has(id)) toggleLocal(id);
        unsave.mutate({ kind: "destination", refId: id });
      } else {
        if (!localFavs.has(id)) toggleLocal(id);
        save.mutate({ kind: "destination", refId: id });
      }
    },
    [customer, ids, localFavs, save, unsave, toggleLocal],
  );

  return { ids, toggle, isServer: Boolean(customer) };
}

/** Send søket til kontoen når kunden er innlogget — ellers ingenting. */
export function useRecordSearch() {
  const { customer } = useCustomer();
  const utils = trpc.useUtils();
  const record = trpc.account.recordSearch.useMutation({ onSuccess: () => utils.account.searchHistory.invalidate() });
  return useCallback(
    (input: { origin: string; destination: string; departDate: string; returnDate?: string; adults: number; children: number; infants: number; cabin: "economy" | "premium_economy" | "business" | "first" }) => {
      if (!customer) return;
      record.mutate(input);
    },
    [customer, record],
  );
}
