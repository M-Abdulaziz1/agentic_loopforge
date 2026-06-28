import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Artifact, Results, RunContext } from "./types";

export function useResults(runId: string) {
  return useQuery({
    queryKey: ["runs", runId, "results"],
    queryFn: () => apiFetch<Results>(`/api/runs/${runId}/results`),
    enabled: Boolean(runId),
  });
}

export function useRunContext(runId: string) {
  return useQuery({
    queryKey: ["runs", runId, "context"],
    queryFn: () => apiFetch<RunContext>(`/api/runs/${runId}/context`),
    enabled: Boolean(runId),
  });
}

export function useArtifacts(runId: string) {
  return useQuery({
    queryKey: ["runs", runId, "artifacts"],
    queryFn: () => apiFetch<Artifact[]>(`/api/runs/${runId}/artifacts`),
    enabled: Boolean(runId),
  });
}
