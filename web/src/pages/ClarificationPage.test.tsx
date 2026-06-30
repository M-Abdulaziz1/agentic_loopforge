import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Providers } from "../app/Providers";
import { ClarificationPage } from "./ClarificationPage";

function Loc() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/goals/:goalId/clarify" element={<ClarificationPage />} />
          <Route path="*" element={<Loc />} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );
}

test("shows the current question and clarity score", async () => {
  renderAt("/goals/goal_churn_q2/clarify");
  expect(await screen.findByText(/How many validated drivers/)).toBeInTheDocument();
  expect(screen.getByText("72")).toBeInTheDocument();
});

test("answering a ready question navigates to the generated loop spec", async () => {
  renderAt("/goals/goal_churn_q2/clarify");
  const box = await screen.findByLabelText("Answer");
  await userEvent.type(box, "top 3 validated drivers");
  await userEvent.click(screen.getByRole("button", { name: /Send/ }));
  expect(await screen.findByTestId("loc")).toHaveTextContent("/specs/spec_churn_v1");
});

test("selecting a suggested option submits it and navigates to the spec", async () => {
  renderAt("/goals/goal_churn_q2/clarify");
  await userEvent.click(await screen.findByRole("button", { name: "At least 3 drivers" }));
  expect(await screen.findByTestId("loc")).toHaveTextContent("/specs/spec_churn_v1");
});
