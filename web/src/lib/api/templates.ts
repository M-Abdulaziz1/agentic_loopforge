import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { LoopSpec, LoopTemplate, LoopTemplateCreate } from "./types";

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: () => apiFetch<LoopTemplate[]>("/api/templates"),
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LoopTemplateCreate) =>
      apiFetch<LoopTemplate>("/api/templates", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useInstantiateTemplate() {
  return useMutation({
    mutationFn: ({ templateId, goalId }: { templateId: string; goalId: string }) =>
      apiFetch<LoopSpec>(`/api/templates/${templateId}/instantiate`, {
        method: "POST",
        body: JSON.stringify({ goal_id: goalId }),
      }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      apiFetch<null>(`/api/templates/${templateId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}
