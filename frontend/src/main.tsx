import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import App from "./App";
import { trpc, getTrpcClient } from "./lib/trpc";
import { useAuthStore } from "./store/authStore";
import "./index.css";

function Root() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000, retry: 1 } },
  }));
  const [trpcClient] = useState(() => getTrpcClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SessionBootstrap />
          <App />
          <Toaster position="top-right" />
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

// Al cargar la app, intenta renovar el access token usando el refresh token
// (cookie httpOnly). Así el usuario no pierde la sesión al recargar la página,
// sin necesidad de guardar tokens en localStorage.
function SessionBootstrap() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const utils = trpc.useUtils();
  const refreshMutation = trpc.auth.refresh.useMutation();

  React.useEffect(() => {
    refreshMutation.mutate(undefined, {
      onSuccess: async (data: any) => {
        setAccessToken(data.accessToken);
        const me = await utils.auth.me.fetch();
        useAuthStore.getState().setSession(me, data.accessToken);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
