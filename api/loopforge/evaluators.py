from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from api.loopforge.domain import EvaluationResult, Evaluator, EvaluatorDirection, EvaluatorKind
from api.loopforge.providers import LLMProvider, SandboxProvider


@dataclass(frozen=True)
class EvaluationCandidate:
    metadata: dict[str, object] = field(default_factory=dict)
    text: str | None = None


class EvaluatorProvider(Protocol):
    def evaluate(self, candidate: EvaluationCandidate, dataset=None, context: dict[str, object] | None = None) -> EvaluationResult: ...


class StatisticalInsightEvaluator:
    def __init__(self, *, alpha: float = 0.05, min_abs_effect: float = 0.0) -> None:
        self.alpha = alpha
        self.min_abs_effect = min_abs_effect

    def evaluate(self, candidate: EvaluationCandidate, dataset=None, context: dict[str, object] | None = None) -> EvaluationResult:
        metadata = candidate.metadata
        p_value = _float(metadata.get("p_value"))
        effect = abs(_float(metadata.get("effect_value")) or 0.0)
        n = _float(metadata.get("n")) or 0.0
        passed = p_value is not None and p_value <= self.alpha and effect > self.min_abs_effect and n > 1
        return EvaluationResult(
            passed=passed,
            score=p_value,
            metric_name="p_value",
            direction=EvaluatorDirection.MINIMIZE,
            detail="statistical insight passed" if passed else "p-value/effect-size validation failed",
        )


class MlBaselineEvaluator:
    def evaluate(self, candidate: EvaluationCandidate, dataset=None, context: dict[str, object] | None = None) -> EvaluationResult:
        metadata = candidate.metadata
        metric = _float(metadata.get("metric_value"))
        baseline = _float(metadata.get("baseline_value"))
        passed = bool(metadata.get("leakage_ok", True)) and (
            bool(metadata.get("beats_baseline")) or (metric is not None and baseline is not None and metric > baseline)
        )
        return EvaluationResult(passed=passed, score=metric, metric_name=str(metadata.get("metric_name") or "metric_value"), direction=EvaluatorDirection.MAXIMIZE, detail="baseline beaten" if passed else "baseline/leakage validation failed")


class CustomMetricEvaluator:
    def __init__(self, *, metric_name: str | None = None, direction: str | EvaluatorDirection | None = None, target: float | None = None) -> None:
        self.metric_name = metric_name or "score"
        self.direction = EvaluatorDirection(direction or EvaluatorDirection.MAXIMIZE)
        self.target = target

    def evaluate(self, candidate: EvaluationCandidate, dataset=None, context: dict[str, object] | None = None) -> EvaluationResult:
        value = _float(candidate.metadata.get(self.metric_name))
        if value is None:
            return EvaluationResult(passed=False, score=None, metric_name=self.metric_name, direction=self.direction, detail="metric missing")
        if self.target is None:
            passed = bool(candidate.metadata.get("passed", False))
        elif self.direction == EvaluatorDirection.MAXIMIZE:
            passed = value >= self.target
        else:
            passed = value <= self.target
        return EvaluationResult(passed=passed, score=value, metric_name=self.metric_name, direction=self.direction, detail="target met" if passed else "target not met")


class LLMRubricEvaluator:
    def __init__(self, *, llm: LLMProvider | None = None, rubric: str | None = None) -> None:
        self.llm = llm
        self.rubric = rubric or "Judge whether the candidate satisfies the objective."

    def evaluate(self, candidate: EvaluationCandidate, dataset=None, context: dict[str, object] | None = None) -> EvaluationResult:
        if self.llm is None:
            passed = bool(candidate.metadata.get("passed", False))
            return EvaluationResult(passed=passed, score=_float(candidate.metadata.get("score")), metric_name="rubric", direction=EvaluatorDirection.MAXIMIZE, detail="rubric fallback")
        response = self.llm.complete(system="loopforge-evaluator", prompt=f"Rubric: {self.rubric}\nCandidate data: {candidate.metadata}\nCandidate text: {candidate.text or ''}\nReturn JSON with passed boolean and optional score.")
        passed = '"passed": true' in response.text.lower() or response.text.strip().lower() == "pass"
        return EvaluationResult(passed=passed, metric_name="rubric", direction=EvaluatorDirection.MAXIMIZE, detail="llm rubric evaluated")


def build_evaluator_provider(evaluator: Evaluator | None, *, llm: LLMProvider | None = None, sandbox: SandboxProvider | None = None) -> EvaluatorProvider:
    if evaluator is None or evaluator.kind == EvaluatorKind.STATISTICAL_INSIGHT:
        config = evaluator.config if evaluator is not None else {}
        return StatisticalInsightEvaluator(alpha=float(config.get("alpha", evaluator.target if evaluator and evaluator.target is not None else 0.05)))
    if evaluator.kind == EvaluatorKind.ML_BASELINE:
        return MlBaselineEvaluator()
    if evaluator.kind == EvaluatorKind.CUSTOM_METRIC:
        return CustomMetricEvaluator(metric_name=evaluator.metric_name, direction=evaluator.direction, target=evaluator.target)
    if evaluator.kind == EvaluatorKind.LLM_RUBRIC:
        return LLMRubricEvaluator(llm=llm, rubric=str(evaluator.config.get("rubric", "")))
    return StatisticalInsightEvaluator()


def candidate_from_agent_output(output: dict[str, object]) -> EvaluationCandidate:
    metadata = dict(output)
    text = str(output.get("report") or output.get("summary") or "")
    return EvaluationCandidate(metadata=metadata, text=text)


def _float(value: object) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None
