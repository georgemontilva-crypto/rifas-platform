import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../backend/src/routers";
import { useAuthStore } from "@/store/authStore";

export const trpc = createTRPCReact<AppRouter>();

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/trpc`,
        transformer: superjson,
        // El refresh token viaja en cookie httpOnly; el access token va en este header
        headers() {
          const token = useAuthStore.getState().accessToken;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        fetch(url, options) {
          return fetch(url, { ...options, credentials: "include" });
        },
      }),
    ],
  });
}
