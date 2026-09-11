import { QueryClient } from "@tanstack/react-query";

// Reutiliza leituras recentes ao navegar, sem deixar dados operacionais velhos por muito tempo.
export const createAppQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 15 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});
