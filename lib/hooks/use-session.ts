"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api/client";
import type { MockUser } from "@/lib/mock-user";

export interface SessionResponse {
  user: MockUser;
}

const SESSION_STALE_TIME_MS = 5 * 60 * 1000; // 5 min, per cache mapping table

/**
 * Session is deliberately a TanStack Query hook (`['session']`, 5 min
 * staleTime) rather than a Zustand store — there's no client-only state to
 * hold beyond what `GET /api/auth/session` already returns, so a store
 * would just duplicate server state. See final report for more detail; the
 * planning doc's `useSessionStore` mention is superseded by this.
 */
export function useSession() {
  return useQuery<SessionResponse>({
    queryKey: ["session"],
    queryFn: () => apiClient.get<SessionResponse>("/auth/session"),
    staleTime: SESSION_STALE_TIME_MS,
    retry: (failureCount, error) => {
      // A 401 means "not logged in", not "transient failure" — retrying
      // just delays the dashboard gate from resolving.
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 2;
    },
  });
}
