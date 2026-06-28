import { renderHook, waitFor } from "@testing-library/react";
import { Providers } from "../../app/Providers";
import { useClarification, useSubmitAnswer } from "./clarification";

test("useClarification loads the session", async () => {
  const { result } = renderHook(() => useClarification("goal_churn_q2"), {
    wrapper: Providers,
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.clarity_score).toBeCloseTo(0.72);
});

test("useSubmitAnswer returns the generated loop spec when ready", async () => {
  const { result } = renderHook(() => useSubmitAnswer("goal_churn_q2"), {
    wrapper: Providers,
  });
  const res = await result.current.mutateAsync({ question_id: "q_success", answer: "top 3" });
  expect(res.clarification.status).toBe("ready");
  expect(res.loop_spec?.id).toBe("spec_churn_v1");
});
