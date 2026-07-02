import { useRef, useState } from "react";
import { GlassCard } from "../components/ui/GlassCard";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Field";
import {
  useDatasets,
  useDeleteDataset,
  useUploadDataset,
  datasetUploadErrorMessage,
} from "../lib/api/datasets";
import type { Dataset, DatasetStatus } from "../lib/api/types";

type BadgeTone = "neutral" | "brand" | "ok" | "warn" | "bad";
const STATUS_TONE: Record<DatasetStatus, BadgeTone> = {
  ready: "ok",
  profiling: "brand",
  uploaded: "warn",
  failed: "bad",
};

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DatasetsPage() {
  const { data: datasets = [], isLoading } = useDatasets();
  const upload = useUploadDataset();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");

  function submit() {
    if (!file) return;
    upload.mutate(
      { file, name: name || undefined },
      {
        onSuccess: () => {
          setFile(null);
          setName("");
          if (fileRef.current) fileRef.current.value = "";
        },
      },
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-4 border-b border-[var(--line)] px-7 py-4">
        <h1 className="font-display text-[28px] leading-none text-ink">Datasets</h1>
      </div>

      <div className="flex-1 overflow-auto p-7">
        <div className="mx-auto grid max-w-[980px] grid-cols-[1fr_340px] gap-6">
          <div>
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-mut">
              Uploaded datasets
            </div>
            {isLoading ? (
              <div className="text-mut">Loading…</div>
            ) : datasets.length === 0 ? (
              <div className="text-mut">
                No datasets yet — upload a CSV or Parquet file on the right.
              </div>
            ) : (
              <div className="space-y-3">
                {datasets.map((d) => (
                  <DatasetRow key={d.id} dataset={d} />
                ))}
              </div>
            )}
          </div>

          <GlassCard className="h-fit">
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-mut">
              Upload dataset
            </div>
            <p className="mb-3 text-[12px] leading-relaxed text-mut">
              CSV or Parquet. Mounted <b>read-only</b> into the sandbox; profiled with
              sample values <b>PII-masked</b>.
            </p>
            <input
              ref={fileRef}
              type="file"
              aria-label="Dataset file"
              accept=".csv,.parquet"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mb-3 w-full text-[12px] text-ink2 file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--glass2)] file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-ink"
            />
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.88px] text-mut">
              Display name (optional)
            </div>
            <Input
              type="text"
              aria-label="Display name"
              value={name}
              placeholder={file?.name ?? "customers_q2"}
              onChange={(e) => setName(e.target.value)}
              className="mb-3"
            />
            {upload.isError ? (
              <div className="mb-3 rounded-lg bg-[color-mix(in_srgb,var(--bad)_11%,var(--surface))] px-3 py-1.5 text-[12px] text-bad">
                {datasetUploadErrorMessage(upload.error)}
              </div>
            ) : null}
            <Button className="w-full" onClick={submit} disabled={!file} loading={upload.isPending}>
              {upload.isPending ? "Uploading…" : "Upload dataset"}
            </Button>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function DatasetRow({ dataset }: { dataset: Dataset }) {
  const del = useDeleteDataset();
  const [open, setOpen] = useState(false);
  const cols = dataset.profile?.columns ?? [];

  return (
    <GlassCard>
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-semibold text-ink">{dataset.name}</span>
        <Badge tone={STATUS_TONE[dataset.status]}>{dataset.status}</Badge>
        <span className="ml-auto rounded-md bg-[var(--glass2)] px-2 py-0.5 text-[11px] uppercase text-mut">
          {dataset.kind}
        </span>
      </div>
      <div className="mt-1.5 font-mono text-[12px] text-mut">
        {dataset.filename} · {fmtSize(dataset.size_bytes)}
        {dataset.profile
          ? ` · ${dataset.profile.row_count.toLocaleString()} rows × ${dataset.profile.column_count} cols`
          : ""}
      </div>
      {dataset.status === "failed" && dataset.detail ? (
        <div className="mt-2 rounded-lg bg-[color-mix(in_srgb,var(--bad)_11%,var(--surface))] px-3 py-1.5 text-[12px] text-bad">
          {dataset.detail}
        </div>
      ) : null}

      {cols.length > 0 && open ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-[var(--line)]">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-[var(--glass2)] text-mut">
              <tr>
                <th className="px-3 py-1.5 font-semibold">Column</th>
                <th className="px-3 py-1.5 font-semibold">Type</th>
                <th className="px-3 py-1.5 font-semibold">Nulls</th>
                <th className="px-3 py-1.5 font-semibold">Unique</th>
                <th className="px-3 py-1.5 font-semibold">Sample (masked)</th>
              </tr>
            </thead>
            <tbody>
              {cols.map((c) => (
                <tr key={c.name} className="border-t border-[var(--line)]">
                  <td className="px-3 py-1.5 font-mono text-ink">{c.name}</td>
                  <td className="px-3 py-1.5 text-ink2">{c.dtype}</td>
                  <td className="px-3 py-1.5 text-ink2">{c.null_count}</td>
                  <td className="px-3 py-1.5 text-ink2">{c.unique_count}</td>
                  <td className="px-3 py-1.5 font-mono text-mut">
                    {c.sample.slice(0, 3).join(", ")}
                    {c.pii_masked ? " 🔒" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        {cols.length > 0 ? (
          <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide profile" : "View profile"}
          </Button>
        ) : null}
        <Button
          variant="danger"
          size="sm"
          className="ml-auto"
          onClick={() => del.mutate(dataset.id)}
          loading={del.isPending}
        >
          Delete
        </Button>
      </div>
    </GlassCard>
  );
}
