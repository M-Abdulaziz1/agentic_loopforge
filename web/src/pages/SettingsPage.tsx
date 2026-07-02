import { useState } from "react";
import { GlassCard } from "../components/ui/GlassCard";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Field";
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
        <h1 className="font-display text-[28px] leading-none text-ink">Settings · LLM Providers</h1>
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
              <Select
                aria-label="Kind"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as LLMProviderKind })}
              >
                <option className="bg-surface text-ink" value="openai_compatible">openai_compatible</option>
                <option className="bg-surface text-ink" value="anthropic">anthropic</option>
              </Select>
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
                className="size-4 accent-[var(--violet)]"
              />
              Set as default
            </label>
            <Button
              className="w-full"
              onClick={submit}
              disabled={!form.name || !form.model}
              loading={create.isPending}
            >
              Add provider
            </Button>
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
          <span className="rounded-md bg-[color-mix(in_srgb,var(--ok)_12%,var(--surface))] px-2 py-0.5 text-[11px] font-bold text-ok">
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
              ? "bg-[color-mix(in_srgb,var(--ok)_11%,var(--surface))] text-ok"
              : "bg-[color-mix(in_srgb,var(--bad)_11%,var(--surface))] text-bad",
          )}
        >
          {test.data.ok ? `✓ reachable${test.data.model ? ` · ${test.data.model}` : ""}` : `✕ ${test.data.detail ?? "failed"}`}
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => test.mutate(provider.id)} loading={test.isPending}>
          {test.isPending ? "Testing…" : "Test"}
        </Button>
        {!provider.is_default ? (
          <Button variant="secondary" size="sm" onClick={() => update.mutate({ is_default: true })}>
            Set default
          </Button>
        ) : null}
        <Button variant="danger" size="sm" className="ml-auto" onClick={() => del.mutate(provider.id)}>
          Delete
        </Button>
      </div>
    </GlassCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.88px] text-mut">{label}</div>
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
      className="h-11 w-full rounded-lg border border-[var(--line2)] bg-[var(--surface)] px-3.5 text-[14px] text-ink placeholder:text-[var(--mut-soft)] outline-none transition focus:border-[var(--violet)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--violet)_22%,transparent)]"
    />
  );
}
