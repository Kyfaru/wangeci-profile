"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Default staleTime (5 min) matches the most common cache-mapping entry
 * (library, session). Endpoints with a different contract — reader chapter
 * (1hr), notifications (poll 60s), search (5 min + 300ms debounce
 * client-side), cart (always refetch on focus) — should override
 * `staleTime`/`refetchInterval`/`refetchOnWindowFocus` on their own
 * `useQuery` call rather than here, since those are per-query concerns.
 */
const DEFAULT_STALE_TIME_MS = 5 * 60 * 1000;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  // Created once per component instance (client-only), so navigation
  // between routes doesn't reset the cache the way a module-level
  // singleton created at import time could under React Strict Mode /
  // fast refresh.
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
