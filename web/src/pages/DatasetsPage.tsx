import { useRef, useState } from "react";
import { GlassCard } from "../components/ui/GlassCard";
import { cn } from "../lib/cn";
import {
  useDatasets,
  useDeleteDataset,
  useUploadDataset,
} from "../lib/api/datasets";
import type { Dataset, DatasetStatus } from "../lib/api/types";

const STATUS_STYLE: Record<DatasetStatus, string> = {
  ready: "bg-[rgba(70,227,173,.14)] text-[#9af3d4]",
  profiling: "bg-[rgba(138,108,255,.2)] text-[#dcd0ff]",
  uploaded: "bg-[rgba(255,209,102,.15)] text-[#ffe2a0]",
  failed: "bg-[rgba(255,107,154,.14)] text-[#ffd0e0]",
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
        <h1 className="text-base font-bold text-ink">Datasets</h1>
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
            <div className="mb-1.5 text-[10px] font-bold tracking-[.6px] text-mut">
              Display name (optional)
            </div>
            <input
              type="text"
              aria-label="Display name"
              value={name}
              placeholder={file?.name ?? "customers_q2"}
              onChange={(e) => setName(e.target.value)}
              className="mb-3 w-full rounded-lg border border-[var(--line2)] bg-white/[0.03] px-3 py-2 text-[13px] text-ink outline-none focus:border-[#cdbcff]"
            />
            {upload.isError ? (
              <div className="mb-3 rounded-lg bg-[rgba(255,107,154,.12)] px-3 py-1.5 text-[12px] text-[#ffd0e0]">
                Upload failed — check file type and size.
              </div>
            ) : null}
            <button
              type="button"
              onClick={submit}
              disabled={!file || upload.isPending}
              className="w-full rounded-xl bg-gradient-to-br from-violet to-teal px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
            >
              {upload.isPending ? "Uploading…" : "Upload dataset"}
            </button>
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
        <span className="text-[15px] font-bold">{dataset.name}</span>
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-[11px] font-bold",
            STATUS_STYLE[dataset.status],
          )}
        >
          {dataset.status}
        </span>
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
        <div className="mt-2 rounded-lg bg-[rgba(255,107,154,.12)] px-3 py-1.5 text-[12px] text-[#ffd0e0]">
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
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg border border-[var(--line2)] bg-[var(--glass2)] px-3 py-1.5 text-[12px] font-semibold"
          >
            {open ? "Hide profile" : "View profile"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => del.mutate(dataset.id)}
          disabled={del.isPending}
          className="ml-auto rounded-lg border border-[rgba(255,107,154,.35)] bg-[rgba(255,107,154,.12)] px-3 py-1.5 text-[12px] font-semibold text-[#ffd0e0]"
        >
          Delete
        </button>
      </div>
    </GlassCard>
  );
}
