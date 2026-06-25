from api.loopforge.context import ContextManager, estimate_tokens
from api.loopforge.domain import ContextEntry, RunStatus


def test_estimate_tokens_uses_conservative_word_based_fallback() -> None:
    assert estimate_tokens("one two three four") == 6


def test_context_pack_prefers_recent_and_tagged_entries() -> None:
    manager = ContextManager(max_tokens=20)
    entries = [
        ContextEntry(run_id="run_1", kind="message", text="old planning note", tags=["plan"]),
        ContextEntry(run_id="run_1", kind="artifact", text="important result details", tags=["result"]),
        ContextEntry(run_id="run_1", kind="message", text="latest executor update", tags=["execution"]),
    ]

    pack = manager.build_pack(entries, task="summarize result", required_tags=["result"])

    assert pack.overflow is False
    assert "important result details" in [entry.text for entry in pack.entries]
    assert pack.token_count <= 20


def test_context_pack_overflows_when_required_entry_cannot_fit() -> None:
    manager = ContextManager(max_tokens=3)
    entries = [
        ContextEntry(run_id="run_1", kind="artifact", text="critical requirement cannot fit", tags=["required"])
    ]

    pack = manager.build_pack(entries, task="use requirement", required_tags=["required"])

    assert pack.overflow is True
    assert pack.summary == RunStatus.CONTEXT_OVERFLOW.value
