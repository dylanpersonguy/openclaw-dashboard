"use client";

import { useAuth } from "@clerk/nextjs";
import {
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
} from "@tanstack/react-query";

import { getApiBaseUrl } from "@/lib/api-base";

const apiBase = getApiBaseUrl();

type ApiRequestOptions = {
  token?: string | null;
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
};

export async function apiRequest<T>(
  path: string,
  { token, method = "GET", body, headers }: ApiRequestOptions = {}
) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || "Request failed.");
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export function useAuthedQuery<T>(
  key: QueryKey,
  path: string | null,
  options: Omit<
    UseQueryOptions<T, Error, T, QueryKey>,
    "queryKey" | "queryFn"
  > = {}
) {
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: key,
    enabled: Boolean(isSignedIn && path) && (options.enabled ?? true),
    queryFn: async () => {
      const token = await getToken();
      return apiRequest<T>(path as string, { token });
    },
    ...options,
  });
}

export function useAuthedMutation<TData, TVariables, TContext = unknown>(
  mutationFn: (variables: TVariables, token: string | null) => Promise<TData>,
  options?: UseMutationOptions<TData, Error, TVariables, TContext>
) {
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async (variables) => {
      const token = await getToken();
      return mutationFn(variables, token);
    },
    ...options,
  });
}
