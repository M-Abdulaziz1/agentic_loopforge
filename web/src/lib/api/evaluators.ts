import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Evaluator, EvaluatorCreate, EvaluatorUpdate } from "./types";

export function useEvaluators() {
  return useQuery({
    queryKey: ["evaluators"],
    queryFn: () => apiFetch<Evaluator[]>("/api/evaluators"),
  });
}

export function useCreateEvaluator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EvaluatorCreate) =>
      apiFetch<Evaluator>("/api/evaluators", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["evaluators"] }),
  });
}

export function useUpdateEvaluator(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: EvaluatorUpdate) =>
      apiFetch<Evaluator>(`/api/evaluators/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["evaluators"] }),
  });
}

export function useDeleteEvaluator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<null>(`/api/evaluators/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["evaluators"] }),
  });
}
