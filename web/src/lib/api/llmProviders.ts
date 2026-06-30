import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type {
  LLMProvider,
  LLMProviderCreate,
  LLMProviderUpdate,
  LLMTestResult,
} from "./types";

export function useLlmProviders() {
  return useQuery({
    queryKey: ["llm-providers"],
    queryFn: () => apiFetch<LLMProvider[]>("/api/llm-providers"),
  });
}

export function useCreateLlmProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LLMProviderCreate) =>
      apiFetch<LLMProvider>("/api/llm-providers", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["llm-providers"] }),
  });
}

export function useUpdateLlmProvider(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: LLMProviderUpdate) =>
      apiFetch<LLMProvider>(`/api/llm-providers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["llm-providers"] }),
  });
}

export function useDeleteLlmProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<null>(`/api/llm-providers/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["llm-providers"] }),
  });
}

export function useTestLlmProvider() {
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<LLMTestResult>(`/api/llm-providers/${id}/test`, { method: "POST" }),
  });
}
