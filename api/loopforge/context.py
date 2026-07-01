from __future__ import annotations

from collections.abc import Iterable
from typing import Protocol
import re

from api.loopforge.domain import ContextEntry, ContextPack, RunStatus


class TokenCounter(Protocol):
    def count(self, text: str) -> int:
        raise NotImplementedError


class FallbackTokenCounter:
    def count(self, text: str) -> int:
        return estimate_tokens(text)


class ContextCompactorLLM(Protocol):
    def complete(self, *, system: str, prompt: str):
        raise NotImplementedError


def estimate_tokens(text: str) -> int:
    words = [word for word in text.replace("\n", " ").split(" ") if word]
    return max(1, int(len(words) * 1.5))


class ContextManager:
    def __init__(self, max_tokens: int, *, token_counter: TokenCounter | None = None, compactor_llm: ContextCompactorLLM | None = None) -> None:
        self.max_tokens = max_tokens
        self.token_counter = token_counter or FallbackTokenCounter()
        self.compactor_llm = compactor_llm

    def build_pack(
        self,
        entries: Iterable[ContextEntry],
        task: str,
        required_tags: list[str] | None = None,
    ) -> ContextPack:
        required_tags = required_tags or []
        prepared = [self._with_tokens(entry) for entry in entries]
        required = [
            entry
            for entry in prepared
            if any(tag in entry.tags for tag in required_tags)
        ]
        selected: list[ContextEntry] = []
        used = self.token_counter.count(task)

        for entry in required:
            if used + entry.token_count > self.max_tokens:
                return ContextPack(
                    entries=[],
                    summary=RunStatus.CONTEXT_OVERFLOW.value,
                    token_count=used,
                    overflow=True,
                )
            selected.append(entry)
            used += entry.token_count

        for entry in sorted((entry for entry in prepared if entry not in selected), key=_entry_priority, reverse=True):
            if used + entry.token_count <= self.max_tokens:
                selected.append(entry)
                used += entry.token_count

        selected.sort(key=lambda entry: entry.created_at)
        omitted = [entry for entry in prepared if entry not in selected]
        summary = self.compact(omitted)
        summary_tokens = self.token_counter.count(summary) if summary else 0
        if summary and used + summary_tokens > self.max_tokens:
            fallback = f"Compacted {len(omitted)} older context entries."
            fallback_tokens = self.token_counter.count(fallback)
            if used + fallback_tokens <= self.max_tokens:
                summary = fallback
                summary_tokens = fallback_tokens
            else:
                summary = ""
                summary_tokens = 0
        return ContextPack(entries=selected, summary=summary, token_count=used + summary_tokens, overflow=False)

    def compact(self, entries: Iterable[ContextEntry]) -> str:
        items = list(entries)
        if not items:
            return ""
        if self.compactor_llm is not None:
            prompt = _compaction_prompt(items)
            response = self.compactor_llm.complete(system=CONTEXT_COMPACTION_SYSTEM, prompt=prompt)
            return _sanitize_text(str(response.text)).strip()
        decisions = [_sanitize_text(entry.text) for entry in items if "decision" in entry.tags]
        if decisions:
            return "Compacted decisions: " + " | ".join(decisions)
        return f"Compacted {len(items)} older context entries."

    def _with_tokens(self, entry: ContextEntry) -> ContextEntry:
        if entry.token_count > 0:
            return entry
        return entry.model_copy(update={"token_count": self.token_counter.count(entry.text)})


CONTEXT_COMPACTION_SYSTEM = (
    "Context compaction for LoopForge. Summarize omitted run context for the next agent turn. "
    "Preserve decisions, blockers/errors, generated files, metrics, artifacts, and next actions. "
    "Do not invent facts. Do not include secrets or raw PII. Return concise plain text."
)


def _entry_priority(entry: ContextEntry) -> tuple[int, object]:
    tags = set(entry.tags)
    score = 0
    if tags & {"required", "goal", "dataset"}:
        score += 100
    if tags & {"error", "blocker", "decision"}:
        score += 80
    if tags & {"metric", "artifact", "agent_output"}:
        score += 60
    if tags & {"tool_output", "code"}:
        score += 30
    return (score, entry.created_at)


def _compaction_prompt(entries: list[ContextEntry]) -> str:
    rendered = []
    for entry in entries:
        text = _sanitize_text(entry.text)
        rendered.append(f"- kind={entry.kind}; tags={','.join(entry.tags)}; text={text[:3000]}")
    return "Omitted context entries:\n" + "\n".join(rendered)


def _sanitize_text(text: str) -> str:
    text = re.sub(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b", "[REDACTED_EMAIL]", text)
    return re.sub(r"\b\d{3}-\d{2}-\d{4}\b", "[REDACTED_SSN]", text)
