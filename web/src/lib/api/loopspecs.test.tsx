import { renderHook, waitFor } from "@testing-library/react";
import { Providers } from "../../app/Providers";
import { useApproveLoopSpec, useLoopSpec } from "./loopspecs";

test("useLoopSpec loads a spec", async () => {
  const { result } = renderHook(() => useLoopSpec("spec_churn_v1"), { wrapper: Providers });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.agents).toHaveLength(4);
});

test("useApproveLoopSpec returns the approved spec", async () => {
  const { result } = renderHook(() => useApproveLoopSpec("spec_churn_v1"), {
    wrapper: Providers,
  });
  const res = await result.current.mutateAsync();
  expect(res.status).toBe("approved");
});
