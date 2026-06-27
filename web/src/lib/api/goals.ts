import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Goal } from "./types";

export function useGoals() {
  return useQuery({ queryKey: ["goals"], queryFn: () => apiFetch<Goal[]>("/api/goals") });
}
