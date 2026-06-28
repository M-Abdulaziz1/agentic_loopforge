import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { ClarificationAnswer, ClarificationResult, ClarificationSession } from "./types";

export function useClarification(goalId: string) {
  return useQuery({
    queryKey: ["clarification", goalId],
    queryFn: () =>
      apiFetch<ClarificationSession>(`/api/goals/${goalId}/clarification`),
    enabled: Boolean(goalId),
  });
}

export function useSubmitAnswer(goalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (answer: ClarificationAnswer) =>
      apiFetch<ClarificationResult>(`/api/goals/${goalId}/clarification/answers`, {
        method: "POST",
        body: JSON.stringify(answer),
      }),
    onSuccess: (res) => {
      qc.setQueryData(["clarification", goalId], res.clarification);
    },
  });
}
