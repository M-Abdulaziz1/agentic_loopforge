import { renderHook, waitFor } from "@testing-library/react";
import { Providers } from "../../app/Providers";
import { useRun, useRunEvents, useCancelRun } from "./runs";

test("useRun loads a run", async () => {
  const { result } = renderHook(() => useRun("run_a91c"), { wrapper: Providers });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.status).toBe("running");
});

test("useRunEvents returns the event array", async () => {
  const { result } = renderHook(() => useRunEvents("run_a91c", false), {
    wrapper: Providers,
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.length).toBe(6);
});

test("useCancelRun returns a cancelled run", async () => {
  const { result } = renderHook(() => useCancelRun("run_a91c"), { wrapper: Providers });
  const run = await result.current.mutateAsync();
  expect(run.status).toBe("cancelled");
});
