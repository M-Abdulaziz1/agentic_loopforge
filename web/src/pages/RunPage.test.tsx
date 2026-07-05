import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Providers } from "../app/Providers";
import { server } from "../test/msw";
import { sampleRun } from "../test/fixtures";
import { RunPage } from "./RunPage";

function Loc() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname}</div>;
}

function renderRun() {
  return render(
    <Providers>
      <MemoryRouter initialEntries={["/runs/run_a91c"]}>
        <Loc />
        <Routes>
          <Route path="/runs/:runId" element={<RunPage />} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );
}

test("shows live status and the step meter", async () => {
  renderRun();
  expect(await screen.findByTestId("run-status")).toHaveTextContent("RUNNING");
  expect(screen.getByText("STEPS")).toBeInTheDocument();
});

test("the Events tab lists run events", async () => {
  renderRun();
  await screen.findByTestId("run-status");
  await userEvent.click(screen.getByRole("button", { name: "Events" }));
  expect(await screen.findByText("Entered planner")).toBeInTheDocument();
});

test("a failed run offers Rerun and Edit loop and rerun opens the new run", async () => {
  // Unique runId so this doesn't collide with the shared query cache from the live-run tests.
  server.use(
    http.get("/api/runs/:runId", () =>
      HttpResponse.json({ ...sampleRun, id: "run_failed1", status: "failed" }),
    ),
    http.post("/api/goals/:goalId/runs", () =>
      HttpResponse.json({ ...sampleRun, id: "run_new99", status: "pending_approval" }, { status: 201 }),
    ),
  );
  render(
    <Providers>
      <MemoryRouter initialEntries={["/runs/run_failed1"]}>
        <Loc />
        <Routes>
          <Route path="/runs/:runId" element={<RunPage />} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );
  await screen.findByTestId("run-status");

  const editLink = await screen.findByRole("link", { name: /Edit loop/ });
  expect(editLink).toHaveAttribute("href", `/specs/${sampleRun.loop_spec_id}/edit`);

  await userEvent.click(screen.getByRole("button", { name: /Rerun/ }));
  expect(await screen.findByTestId("loc")).toHaveTextContent("/runs/run_new99");
});
