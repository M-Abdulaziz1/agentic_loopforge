from __future__ import annotations

from collections.abc import Iterable

from api.loopforge.domain import ContextEntry, ContextPack, RunStatus


def estimate_tokens(text: str) -> int:
    words = [word for word in text.replace("\n", " ").split(" ") if word]
    return max(1, int(len(words) * 1.5))


class ContextManager:
    def __init__(self, max_tokens: int) -> None:
        self.max_tokens = max_tokens

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
        used = estimate_tokens(task)

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

        for entry in reversed(prepared):
            if entry in selected:
                continue
            if used + entry.token_count <= self.max_tokens:
                selected.append(entry)
                used += entry.token_count

        selected.reverse()
        summary = self.compact([entry for entry in prepared if entry not in selected])
        return ContextPack(entries=selected, summary=summary, token_count=used, overflow=False)

    def compact(self, entries: Iterable[ContextEntry]) -> str:
        items = list(entries)
        if not items:
            return ""
        decisions = [entry.text for entry in items if "decision" in entry.tags]
        if decisions:
            return "Compacted decisions: " + " | ".join(decisions)
        return f"Compacted {len(items)} older context entries."

    def _with_tokens(self, entry: ContextEntry) -> ContextEntry:
        if entry.token_count > 0:
            return entry
        return entry.model_copy(update={"token_count": estimate_tokens(entry.text)})
