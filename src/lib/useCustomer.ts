import { trpc } from "@/providers/trpc";

/** Innlogget kunde (eller null). Bruk customer?.firstName til hilsener. */
export function useCustomer() {
  const me = trpc.customerAuth.me.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });
  const utils = trpc.useUtils();
  const logout = trpc.customerAuth.logout.useMutation({
    onSuccess: () => utils.customerAuth.me.invalidate(),
  });
  return {
    customer: me.data ?? null,
    isLoading: me.isLoading,
    logout: logout.mutate,
    isLoggingOut: logout.isPending,
  };
}
