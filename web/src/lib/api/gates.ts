import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Gate, GateDecision } from "./types";

export function useGates(status?: "pending" | "approved" | "rejected") {
  const qs = status ? `?status=${status}` : "";
  return useQuery({
    queryKey: ["gates", status ?? "all"],
    queryFn: () => apiFetch<Gate[]>(`/api/gates${qs}`),
  });
}

export function useDecideGate(gateId: string, runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (decision: GateDecision) =>
      apiFetch<Gate>(`/api/gates/${gateId}/decision`, {
        method: "POST",
        body: JSON.stringify(decision),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gates"] });
      qc.invalidateQueries({ queryKey: ["runs", runId, "events"] });
    },
  });
}
