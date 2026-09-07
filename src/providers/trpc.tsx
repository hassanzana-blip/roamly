import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../api/router";
import type { inferRouterOutputs, inferRouterInputs } from "@trpc/server";

/** tRPC-klient (hooks). Provideren ligger i ./TRPCProvider.tsx. */
export const trpc = createTRPCReact<AppRouter>();

export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
