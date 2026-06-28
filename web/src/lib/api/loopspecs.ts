import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { LoopSpec, LoopSpecUpdate } from "./types";

export function useLoopSpec(specId: string) {
  return useQuery({
    queryKey: ["loop-spec", specId],
    queryFn: () => apiFetch<LoopSpec>(`/api/loop-specs/${specId}`),
    enabled: Boolean(specId),
  });
}

export function useApproveLoopSpec(specId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<LoopSpec>(`/api/loop-specs/${specId}/approve`, { method: "POST" }),
    onSuccess: (spec) => qc.setQueryData(["loop-spec", specId], spec),
  });
}

export function useUpdateLoopSpec(specId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: LoopSpecUpdate) =>
      apiFetch<LoopSpec>(`/api/loop-specs/${specId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: (spec) => qc.setQueryData(["loop-spec", specId], spec),
  });
}
