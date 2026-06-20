import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { useAuthStore } from "@/store/authStore";

// Frontend y backend se compilan y sirven juntos desde el mismo proceso
// Express (ver backend/src/index.ts), así que la API queda en el mismo
// origen bajo /api/trpc. No se comparten tipos en build-time entre las
// carpetas frontend/ y backend/ porque cada una puede construirse en un
// contexto aislado; por eso el cliente queda sin tipado estricto del
// router. Para recuperar autocompletado fuerte, conviene mover AppRouter a
// un paquete compartido más adelante.
export const trpc: any = createTRPCReact<any>();

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        headers() {
          const token = useAuthStore.getState().accessToken;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        fetch(url: any, options: any) {
          return fetch(url, { ...options, credentials: "include" });
        },
      }),
    ],
  });
}
