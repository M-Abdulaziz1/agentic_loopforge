from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

import httpx

from api.loopforge.context import estimate_tokens


@dataclass(frozen=True)
class LLMResponse:
    text: str
    tokens_used: int


class LLMProvider(Protocol):
    def complete(self, *, system: str, prompt: str) -> LLMResponse:
        raise NotImplementedError


class LLMProviderError(RuntimeError):
    pass


class OpenAICompatibleLLMProvider:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        timeout_seconds: float = 60.0,
        client: httpx.Client | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.client = client or httpx.Client(timeout=timeout_seconds)

    def complete(self, *, system: str, prompt: str) -> LLMResponse:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0,
        }
        try:
            response = self.client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as exc:
            raise LLMProviderError(f"OpenAI-compatible provider returned {exc.response.status_code}") from exc
        except httpx.HTTPError as exc:
            raise LLMProviderError(f"OpenAI-compatible provider request failed: {exc}") from exc
        except ValueError as exc:
            raise LLMProviderError("OpenAI-compatible provider returned invalid JSON") from exc

        try:
            text = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMProviderError("OpenAI-compatible provider response did not include message content") from exc

        usage = data.get("usage") or {}
        tokens = usage.get("total_tokens")
        if not isinstance(tokens, int):
            tokens = estimate_tokens(system) + estimate_tokens(prompt) + estimate_tokens(text)
        return LLMResponse(text=text, tokens_used=tokens)


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
