import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "./client";
import type { Dataset } from "./types";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export function useDatasets() {
  return useQuery({
    queryKey: ["datasets"],
    queryFn: () => apiFetch<Dataset[]>("/api/datasets"),
  });
}

export function useDataset(id: string | undefined) {
  return useQuery({
    queryKey: ["datasets", id],
    queryFn: () => apiFetch<Dataset>(`/api/datasets/${id}`),
    enabled: !!id,
  });
}

export function useUploadDataset() {
  const qc = useQueryClient();
  return useMutation({
    // Multipart upload — do NOT set Content-Type; the browser adds the boundary.
    mutationFn: async ({ file, name }: { file: File; name?: string }) => {
      const form = new FormData();
      form.append("file", file);
      if (name) form.append("name", name);
      const res = await fetch(BASE + "/api/datasets", { method: "POST", body: form });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, body);
      return body as Dataset;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["datasets"] }),
  });
}

export function useDeleteDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/api/datasets/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["datasets"] }),
  });
}


export function datasetUploadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const detail =
      typeof error.body === "object" && error.body !== null && "detail" in error.body
        ? String((error.body as { detail?: unknown }).detail)
        : "";
    if (error.status === 413) return detail || "Dataset is larger than the configured upload limit.";
    if (error.status === 415) return detail || "Only CSV and Parquet datasets are supported.";
    if (error.status === 422) return detail || "Upload must include a dataset file.";
    return detail || `Upload failed with API ${error.status}.`;
  }
  return "Upload failed. Check the file and try again.";
}
