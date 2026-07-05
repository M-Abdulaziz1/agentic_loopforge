import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Goal, GoalCreate, GoalCreateResult } from "./types";

export function useGoals() {
  return useQuery({ queryKey: ["goals"], queryFn: () => apiFetch<Goal[]>("/api/goals") });
}

export function useGoal(goalId: string) {
  return useQuery({
    queryKey: ["goals", goalId],
    queryFn: () => apiFetch<Goal>(`/api/goals/${goalId}`),
    enabled: Boolean(goalId),
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GoalCreate) =>
      apiFetch<GoalCreateResult>("/api/goals", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (goalId: string) =>
      apiFetch<void>(`/api/goals/${goalId}`, { method: "DELETE" }),
    onSuccess: () => {
      // Deleting a goal cascades to its runs on the server.
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["runs"] });
    },
  });
}
