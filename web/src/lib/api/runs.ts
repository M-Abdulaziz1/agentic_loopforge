import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Run, RunEvent } from "./types";

export function useRuns() {
  return useQuery({ queryKey: ["runs"], queryFn: () => apiFetch<Run[]>("/api/runs") });
}

export function useRun(runId: string) {
  return useQuery({
    queryKey: ["runs", runId],
    queryFn: () => apiFetch<Run>(`/api/runs/${runId}`),
    enabled: Boolean(runId),
  });
}

/**
 * Fetches run events as a JSON array (Accept: application/json). Polls while the run is
 * live. The SSE (EventSource) transport is wired at backend integration; the contract
 * serves both shapes from the same endpoint.
 */
export function useRunEvents(runId: string, live = true) {
  return useQuery({
    queryKey: ["runs", runId, "events"],
    queryFn: () =>
      apiFetch<RunEvent[]>(`/api/runs/${runId}/events`, {
        headers: { Accept: "application/json" },
      }),
    enabled: Boolean(runId),
    refetchInterval: live ? 1500 : false,
  });
}

export function useStartRun(goalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (loopSpecId: string) =>
      apiFetch<Run>(`/api/goals/${goalId}/runs`, {
        method: "POST",
        body: JSON.stringify({ loop_spec_id: loopSpecId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["runs"] }),
  });
}

export function useCancelRun(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<Run>(`/api/runs/${runId}/cancel`, { method: "POST" }),
    onSuccess: (run) => qc.setQueryData(["runs", runId], run),
  });
}

export function usePauseRun(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<Run>(`/api/runs/${runId}/pause`, { method: "POST" }),
    onSuccess: (run) => qc.setQueryData(["runs", runId], run),
  });
}
