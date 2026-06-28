from fastapi.testclient import TestClient

from api.loopforge.app import create_app
from api.loopforge.domain import Artifact, ContextEntry, Run, RunStatus
from api.loopforge.store import InMemoryStore


def test_plan5_endpoints_return_honest_empty_results_and_context_for_run() -> None:
    client = TestClient(create_app())
    created = client.post(
        "/api/goals",
        json={"text": "Create a three-step local-only backend release checklist"},
    ).json()
    goal_id = created["goal"]["id"]
    spec_id = created["loop_spec"]["id"]
    client.patch(f"/api/loop-specs/{spec_id}", json={"gates": []})
    client.post(f"/api/loop-specs/{spec_id}/approve")
    run = client.post(f"/api/goals/{goal_id}/runs", json={"loop_spec_id": spec_id}).json()

    artifacts = client.get(f"/api/runs/{run['id']}/artifacts")
    results = client.get(f"/api/runs/{run['id']}/results")
    context = client.get(f"/api/runs/{run['id']}/context")

    assert artifacts.status_code == 200
    assert artifacts.json() == []
    assert results.status_code == 200
    assert results.json()["run_id"] == run["id"]
    assert results.json()["status"] == "completed"
    assert results.json()["summary"]["validated"] == 0
    assert results.json()["summary"]["rejected"] == 0
    assert results.json()["insights"] == []
    assert results.json()["models"] == []
    assert context.status_code == 200
    assert len(context.json()["ledger"]) == 1
    assert context.json()["pack"]["overflow"] is False


def test_plan5_results_include_only_validated_insights_and_models() -> None:
    store = InMemoryStore()
    run = store.save_run(Run(goal_id="goal_1", loop_spec_id="spec_1", status=RunStatus.COMPLETED))
    store.save_artifact(
        Artifact(
            run_id=run.id,
            kind="insight",
            metadata={
                "claim": "Revenue rose in Q4",
                "passed": True,
                "test": "mann_whitney_u",
                "p_value": 0.01,
                "effect_name": "delta",
                "effect_value": 0.4,
                "n": 120,
                "correction": "holm",
                "plot_ref": "artifact_plot_1",
            },
        )
    )
    store.save_artifact(
        Artifact(
            run_id=run.id,
            kind="insight",
            metadata={
                "claim": "Unvalidated claim",
                "passed": False,
                "test": "t_test",
                "p_value": 0.7,
                "effect_name": "d",
                "effect_value": 0.01,
                "n": 120,
            },
        )
    )
    store.save_artifact(
        Artifact(
            run_id=run.id,
            kind="model",
            metadata={
                "name": "baseline challenger",
                "metric_name": "accuracy",
                "metric_value": 0.82,
                "baseline_name": "majority",
                "baseline_value": 0.55,
                "beats_baseline": True,
                "leakage_ok": True,
            },
        )
    )

    response = TestClient(create_app(store=store)).get(f"/api/runs/{run.id}/results")
    body = response.json()

    assert response.status_code == 200
    assert body["summary"]["validated"] == 2
    assert body["summary"]["rejected"] == 1
    assert [insight["claim"] for insight in body["insights"]] == ["Revenue rose in Q4"]
    assert body["insights"][0]["rank"] == 1
    assert body["models"][0]["beats_baseline"] is True


def test_plan5_artifacts_and_context_mask_pii_without_erasing_raw_ledger() -> None:
    store = InMemoryStore()
    run = store.save_run(Run(goal_id="goal_1", loop_spec_id="spec_1", status=RunStatus.COMPLETED))
    store.save_artifact(
        Artifact(
            run_id=run.id,
            kind="report",
            metadata={"summary": "Contact jane@example.com for customer 123-45-6789"},
        )
    )
    raw_entry = store.append_context(
        ContextEntry(
            run_id=run.id,
            kind="profile",
            text="Owner jane@example.com has SSN 123-45-6789",
            tags=["required"],
        )
    )
    client = TestClient(create_app(store=store))

    artifacts = client.get(f"/api/runs/{run.id}/artifacts").json()
    context = client.get(f"/api/runs/{run.id}/context").json()

    assert artifacts[0]["metadata"]["summary"] == "Contact [REDACTED_EMAIL] for customer [REDACTED_SSN]"
    assert context["ledger"][0]["text"] == "Owner [REDACTED_EMAIL] has SSN [REDACTED_SSN]"
    assert context["pack"]["entries"][0]["text"] == "Owner [REDACTED_EMAIL] has SSN [REDACTED_SSN]"
    assert store.list_context(run.id)[0].text == raw_entry.text


def test_plan5_endpoints_return_404_for_missing_run() -> None:
    client = TestClient(create_app())

    assert client.get("/api/runs/run_missing/artifacts").status_code == 404
    assert client.get("/api/runs/run_missing/results").status_code == 404
    assert client.get("/api/runs/run_missing/context").status_code == 404
