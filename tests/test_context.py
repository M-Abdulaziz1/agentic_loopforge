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


class RecordingCompactorLLM:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    def complete(self, *, system: str, prompt: str):
        from api.loopforge.providers import LLMResponse

        self.calls.append((system, prompt))
        return LLMResponse(text="DECISION: keep validated model; ERROR: missing metrics handled", tokens_used=9)


def test_context_pack_uses_llm_compactor_for_omitted_entries() -> None:
    llm = RecordingCompactorLLM()
    manager = ContextManager(max_tokens=30, compactor_llm=llm)
    entries = [
        ContextEntry(run_id="run_1", kind="decision", text="Decision: use logistic regression baseline " * 12, tags=["decision"]),
        ContextEntry(run_id="run_1", kind="tool", text="Tool output: rows=100 cols=5 " * 12, tags=["tool_output"]),
        ContextEntry(run_id="run_1", kind="agent_output", text="Latest result: metrics ready", tags=["required"]),
    ]

    pack = manager.build_pack(entries, task="continue run", required_tags=["required"])

    assert pack.overflow is False
    assert pack.summary == "DECISION: keep validated model; ERROR: missing metrics handled"
    assert len(llm.calls) == 1
    assert "Decision: use logistic regression baseline" in llm.calls[0][1]
    assert "Latest result: metrics ready" not in llm.calls[0][1]


def test_context_compaction_summary_is_token_counted() -> None:
    llm = RecordingCompactorLLM()
    manager = ContextManager(max_tokens=24, compactor_llm=llm)
    entries = [
        ContextEntry(run_id="run_1", kind="tool", text="older output with several words " * 12, tags=["tool_output"]),
        ContextEntry(run_id="run_1", kind="agent_output", text="latest required", tags=["required"]),
    ]

    pack = manager.build_pack(entries, task="continue run", required_tags=["required"])

    assert pack.summary
    assert pack.token_count >= estimate_tokens(pack.summary)
