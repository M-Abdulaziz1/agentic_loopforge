import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Providers } from "../app/Providers";
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
