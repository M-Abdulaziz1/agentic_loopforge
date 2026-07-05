import { useState } from "react";
import { GlassCard } from "../components/ui/GlassCard";
import { cn } from "../lib/cn";
import {
  useCreateLlmProvider,
  useDeleteLlmProvider,
  useLlmProviders,
  useTestLlmProvider,
  useUpdateLlmProvider,
} from "../lib/api/llmProviders";
import type { LLMProvider, LLMProviderKind } from "../lib/api/types";

export function SettingsPage() {
  const { data: providers = [], isLoading } = useLlmProviders();
  const create = useCreateLlmProvider();
  const [form, setForm] = useState({
    name: "",
    kind: "openai_compatible" as LLMProviderKind,
    base_url: "",
    model: "",
    api_key: "",
    is_default: providers.length === 0,
  });

  function submit() {
    if (form.name.trim().length < 1 || form.model.trim().length < 1) return;
    create.mutate(
      {
        name: form.name,
        kind: form.kind,
        base_url: form.base_url || undefined,
        model: form.model,
        api_key: form.api_key || undefined,
        is_default: form.is_default,
      },
      {
        onSuccess: () =>
          setForm({
            name: "",
            kind: "openai_compatible",
            base_url: "",
            model: "",
            api_key: "",
            is_default: false,
          }),
      },
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-4 border-b border-[var(--line)] px-7 py-4">
        <h1 className="text-base font-bold text-ink">Settings · LLM Providers</h1>
      </div>

      <div className="flex-1 overflow-auto p-7">
        <div className="mx-auto grid max-w-[900px] grid-cols-[1fr_340px] gap-6">
          <div>
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-mut">
              Configured providers
            </div>
            {isLoading ? (
              <div className="text-mut">Loading…</div>
            ) : providers.length === 0 ? (
              <div className="text-mut">No providers yet — add one on the right.</div>
            ) : (
              <div className="space-y-3">
                {providers.map((p) => (
                  <ProviderRow key={p.id} provider={p} />
                ))}
              </div>
            )}
          </div>

          <GlassCard className="h-fit">
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-mut">
              Add provider
            </div>
            <Field label="Name">
              <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            </Field>
            <Field label="Kind">
              <select
                aria-label="Kind"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as LLMProviderKind })}
                className="w-full rounded-lg border border-[var(--line2)] bg-[var(--glass2)] px-3 py-2 text-[13px] text-ink"
              >
                <option className="bg-bg0" value="openai_compatible">openai_compatible</option>
                <option className="bg-bg0" value="anthropic">anthropic</option>
              </select>
            </Field>
            <Field label="Base URL">
              <Input
                value={form.base_url}
                onChange={(v) => setForm({ ...form, base_url: v })}
                placeholder="http://localhost:8001/v1"
              />
            </Field>
            <Field label="Model">
              <Input value={form.model} onChange={(v) => setForm({ ...form, model: v })} />
            </Field>
            <Field label="API key">
              <Input
                type="password"
                value={form.api_key}
                onChange={(v) => setForm({ ...form, api_key: v })}
                placeholder="stored encrypted; never shown again"
              />
            </Field>
            <label className="mb-3 flex items-center gap-2 text-[13px] text-ink2">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              />
              Set as default
            </label>
            <button
              type="button"
              onClick={submit}
              disabled={create.isPending || !form.name || !form.model}
              className="w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
            >
              Add provider
            </button>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function ProviderRow({ provider }: { provider: LLMProvider }) {
  const update = useUpdateLlmProvider(provider.id);
  const del = useDeleteLlmProvider();
  const test = useTestLlmProvider();

  return (
    <GlassCard>
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-bold">{provider.name}</span>
        {provider.is_default ? (
          <span className="rounded-md bg-[rgba(70,227,173,.14)] px-2 py-0.5 text-[11px] font-bold text-[#9af3d4]">
            default
          </span>
        ) : null}
        <span className="ml-auto rounded-md bg-[var(--glass2)] px-2 py-0.5 text-[11px] text-mut">
          {provider.kind}
        </span>
      </div>
      <div className="mt-1.5 font-mono text-[12px] text-mut">
        {provider.model}
        {provider.base_url ? ` · ${provider.base_url}` : ""} ·{" "}
        {provider.has_api_key ? "🔑 key set" : "no key"}
      </div>
      {test.data ? (
        <div
          className={cn(
            "mt-2 rounded-lg px-3 py-1.5 text-[12px]",
            test.data.ok
              ? "bg-[rgba(70,227,173,.12)] text-[#9af3d4]"
              : "bg-[rgba(255,107,154,.12)] text-[#ffd0e0]",
          )}
        >
          {test.data.ok ? `✓ reachable${test.data.model ? ` · ${test.data.model}` : ""}` : `✕ ${test.data.detail ?? "failed"}`}
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => test.mutate(provider.id)}
          disabled={test.isPending}
          className="rounded-lg border border-[var(--line2)] bg-[var(--glass2)] px-3 py-1.5 text-[12px] font-semibold"
        >
          {test.isPending ? "Testing…" : "Test"}
        </button>
        {!provider.is_default ? (
          <button
            type="button"
            onClick={() => update.mutate({ is_default: true })}
            className="rounded-lg border border-[var(--line2)] bg-[var(--glass2)] px-3 py-1.5 text-[12px] font-semibold"
          >
            Set default
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => del.mutate(provider.id)}
          className="ml-auto rounded-lg border border-[rgba(255,107,154,.35)] bg-[rgba(255,107,154,.12)] px-3 py-1.5 text-[12px] font-semibold text-[#ffd0e0]"
        >
          Delete
        </button>
      </div>
    </GlassCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[10px] font-bold tracking-[.6px] text-mut">{label}</div>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-[var(--line2)] bg-white/[0.03] px-3 py-2 text-[13px] text-ink outline-none focus:border-[var(--accent)]"
    />
  );
}
