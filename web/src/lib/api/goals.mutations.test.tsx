import { renderHook, waitFor } from "@testing-library/react";
import { Providers } from "../../app/Providers";
import { useCreateGoal } from "./goals";
import type { GoalCreate } from "./types";

const input: GoalCreate = {
  text: "find churn drivers",
  mode: "offline_local",
  toggles: { internet: false, code_sandbox: true, local_connectors: true },
  constraints: {},
  budget: { max_steps: 12, max_llm_calls: 20, max_context_tokens: 8000 },
};

test("useCreateGoal posts and returns the create result", async () => {
  const { result } = renderHook(() => useCreateGoal(), { wrapper: Providers });
  const res = await result.current.mutateAsync(input);
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(res.goal.id).toBe("goal_churn_q2");
  expect(res.clarification?.status).toBe("open");
});
