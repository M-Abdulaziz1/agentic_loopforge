import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Providers } from "../app/Providers";
import { sampleClarification, sampleGoal } from "../test/fixtures";
import { server } from "../test/msw";
import { GoalCreatePage } from "./GoalCreatePage";

function Loc() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname}</div>;
}

test("internet toggle is disabled in offline_local mode", () => {
  render(
    <Providers>
      <MemoryRouter>
        <GoalCreatePage />
      </MemoryRouter>
    </Providers>,
  );
  expect(screen.getByRole("switch", { name: "Internet access" })).toBeDisabled();
});

test("submitting routes to clarification when the API returns a session", async () => {
  render(
    <Providers>
      <MemoryRouter initialEntries={["/goals/new"]}>
        <Routes>
          <Route path="/goals/new" element={<GoalCreatePage />} />
          <Route path="*" element={<Loc />} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );
  await userEvent.type(screen.getByLabelText("Goal"), "find churn drivers in q2");
  await userEvent.click(screen.getByRole("button", { name: /Create & check clarity/ }));
  expect(await screen.findByTestId("loc")).toHaveTextContent(
    "/goals/goal_churn_q2/clarify",
  );
});

test("shows the processing overlay while the planner builds the loop", async () => {
  let resolve: (() => void) | undefined;
  const gate = new Promise<void>((r) => {
    resolve = r;
  });
  server.use(
    http.post("/api/goals", async () => {
      await gate;
      return HttpResponse.json(
        { goal: sampleGoal, clarification: sampleClarification, loop_spec: null },
        { status: 201 },
      );
    }),
  );

  render(
    <Providers>
      <MemoryRouter initialEntries={["/goals/new"]}>
        <Routes>
          <Route path="/goals/new" element={<GoalCreatePage />} />
          <Route path="*" element={<Loc />} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );

  await userEvent.type(screen.getByLabelText("Goal"), "find churn drivers in q2");
  await userEvent.click(screen.getByRole("button", { name: /Create & check clarity/ }));

  // While the request is in flight the overlay communicates progress.
  expect(await screen.findByRole("status", { name: "Processing the goal" })).toBeInTheDocument();

  resolve?.();
  expect(await screen.findByTestId("loc")).toHaveTextContent("/goals/goal_churn_q2/clarify");
});

test("uploads a dataset from the goal setup flow and uses it on submit", async () => {
  let submittedDatasetId: unknown = null;
  server.use(
    http.post("/api/goals", async ({ request }) => {
      const body = (await request.json()) as { dataset_id?: unknown };
      submittedDatasetId = body.dataset_id;
      return HttpResponse.json(
        { goal: sampleGoal, clarification: sampleClarification, loop_spec: null },
        { status: 201 },
      );
    }),
  );

  render(
    <Providers>
      <MemoryRouter initialEntries={["/goals/new"]}>
        <Routes>
          <Route path="/goals/new" element={<GoalCreatePage />} />
          <Route path="*" element={<Loc />} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );

  await userEvent.upload(
    screen.getByLabelText("Upload dataset file"),
    new File(["amount\n1\n"], "transactions.csv", { type: "text/csv" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Upload & use dataset" }));

  expect(await screen.findByText(/Using customers_q2/)).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText("Goal"), "find transaction anomalies clearly");
  await userEvent.click(screen.getByRole("button", { name: /Create & check clarity/ }));

  expect(await screen.findByTestId("loc")).toHaveTextContent(
    "/goals/goal_churn_q2/clarify",
  );
  expect(submittedDatasetId).toBe("ds_new");
});
