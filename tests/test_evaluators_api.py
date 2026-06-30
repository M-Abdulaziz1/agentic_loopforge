from fastapi.testclient import TestClient

from api.loopforge.app import create_app
from api.loopforge.store import InMemoryStore


def test_evaluator_crud_default_and_freeze_on_run() -> None:
    store = InMemoryStore()
    client = TestClient(create_app(store=store))

    first = client.post(
        "/api/evaluators",
        json={"name": "Insight", "kind": "statistical_insight", "metric_name": "p_value", "direction": "minimize", "target": 0.05, "is_default": True},
    )
    second = client.post(
        "/api/evaluators",
        json={"name": "Accuracy", "kind": "ml_baseline", "metric_name": "accuracy", "direction": "maximize", "target": 0.8, "is_default": True},
    )
    providers = client.get("/api/evaluators").json()

    assert first.status_code == 201
    assert second.status_code == 201
    assert {item["is_default"] for item in providers} == {False, True}

    patched = client.patch(f"/api/evaluators/{second.json()['id']}", json={"target": 0.85})
    fetched = client.get(f"/api/evaluators/{second.json()['id']}")

    assert patched.status_code == 200
    assert fetched.json()["target"] == 0.85

    goal = client.post("/api/goals", json={"text": "Create a local-only backend release checklist", "evaluator_id": second.json()["id"], "autonomy": "autonomous"}).json()
    spec_id = goal["loop_spec"]["id"]
    client.post(f"/api/loop-specs/{spec_id}/approve")
    started = client.post(f"/api/goals/{goal['goal']['id']}/runs", json={"loop_spec_id": spec_id})
    frozen_patch = client.patch(f"/api/evaluators/{second.json()['id']}", json={"target": 0.9})

    assert started.status_code == 201
    assert frozen_patch.status_code == 409
    assert store.list_audit_events()[-1].action == "evaluator.freeze"

    deleted = client.delete(f"/api/evaluators/{first.json()['id']}")
    assert deleted.status_code == 204


def test_builtin_evaluator_harness_accepts_good_and_rejects_bad_candidates() -> None:
    from api.loopforge.evaluators import CustomMetricEvaluator, EvaluationCandidate, StatisticalInsightEvaluator

    statistical = StatisticalInsightEvaluator(alpha=0.05)
    custom = CustomMetricEvaluator(metric_name="accuracy", direction="maximize", target=0.8)

    good_insight = statistical.evaluate(EvaluationCandidate(metadata={"p_value": 0.01, "effect_value": 0.4, "n": 50}))
    bad_insight = statistical.evaluate(EvaluationCandidate(metadata={"p_value": 0.5, "effect_value": 0.01, "n": 50}))
    good_metric = custom.evaluate(EvaluationCandidate(metadata={"accuracy": 0.9}))
    bad_metric = custom.evaluate(EvaluationCandidate(metadata={"accuracy": 0.7}))

    assert good_insight.passed is True
    assert bad_insight.passed is False
    assert good_metric.passed is True
    assert bad_metric.passed is False
