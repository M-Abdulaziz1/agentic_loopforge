from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from api.loopforge.context import estimate_tokens


@dataclass(frozen=True)
class LLMResponse:
    text: str
    tokens_used: int


class LLMProvider(Protocol):
    def complete(self, *, system: str, prompt: str) -> LLMResponse:
        raise NotImplementedError


class FakeLLMProvider:
    def complete(self, *, system: str, prompt: str) -> LLMResponse:
        text = f"FAKE_RESPONSE system={system} prompt={prompt[:80]}"
        return LLMResponse(text=text, tokens_used=estimate_tokens(system) + estimate_tokens(prompt))


@dataclass(frozen=True)
class SandboxResult:
    exit_code: int
    stdout: str
    stderr: str = ""


class SandboxProvider(Protocol):
    def run_code(self, code: str, *, timeout_seconds: int) -> SandboxResult:
        raise NotImplementedError


@dataclass
class FakeSandboxProvider:
    executions: list[str] = field(default_factory=list)

    def run_code(self, code: str, *, timeout_seconds: int) -> SandboxResult:
        self.executions.append(code)
        return SandboxResult(exit_code=0, stdout="sandbox execution simulated")
