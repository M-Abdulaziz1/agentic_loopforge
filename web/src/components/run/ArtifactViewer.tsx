import { useArtifactContent } from "../../lib/api/results";

type Props = { artifactId: string; onClose: () => void };

export function ArtifactViewer({ artifactId, onClose }: Props) {
  const { data, isLoading } = useArtifactContent(artifactId);

  function copy() {
    if (data?.content) void navigator.clipboard?.writeText(data.content);
  }
  function download() {
    if (!data) return;
    const blob = new Blob([data.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = data.filename ?? `${data.artifact_id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Artifact viewer"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--line2)] bg-[#0c0c20]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-3.5">
          <span className="font-mono text-[13px] font-bold">
            {data?.filename ?? artifactId}
          </span>
          {data?.language ? (
            <span className="rounded-md bg-[var(--glass2)] px-2 py-0.5 text-[11px] text-mut">
              {data.language}
            </span>
          ) : null}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={copy}
              className="rounded-lg border border-[var(--line2)] bg-[var(--glass2)] px-3 py-1.5 text-[12px] font-semibold"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={download}
              className="rounded-lg border border-[var(--line2)] bg-[var(--glass2)] px-3 py-1.5 text-[12px] font-semibold"
            >
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg border border-[var(--line2)] bg-[var(--glass2)] px-3 py-1.5 text-[12px] font-semibold"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="overflow-auto p-4">
          {isLoading || !data ? (
            <div className="text-mut">Loading…</div>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-ink2">
              {data.content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
