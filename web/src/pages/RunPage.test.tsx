import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Providers } from "../app/Providers";
import { RunPage } from "./RunPage";

function renderRun() {
  return render(
    <Providers>
      <MemoryRouter initialEntries={["/runs/run_a91c"]}>
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
  await userEvent.click(screen.getByRole("button", { name: "events" }));
  expect(await screen.findByText("Entered planner")).toBeInTheDocument();
});
