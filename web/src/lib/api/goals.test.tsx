import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/msw";
import { Providers } from "../../app/Providers";
import { useGoals } from "./goals";

test("useGoals returns goals from the API", async () => {
  server.use(
    http.get("/api/goals", () =>
      HttpResponse.json([
        {
          id: "g1",
          text: "find churn",
          mode: "offline_local",
          status: "completed",
          created_at: "2026-06-27T00:00:00Z",
        },
      ]),
    ),
  );
  const { result } = renderHook(() => useGoals(), { wrapper: Providers });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.[0].id).toBe("g1");
});
