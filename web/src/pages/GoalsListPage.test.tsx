import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Providers } from "../app/Providers";
import { GoalsListPage } from "./GoalsListPage";

function Loc() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname}</div>;
}

test("lists goals and links them", async () => {
  render(
    <Providers>
      <MemoryRouter>
        <GoalsListPage />
      </MemoryRouter>
    </Providers>,
  );
  expect(await screen.findByText(/Find the main drivers of customer churn/)).toBeInTheDocument();
});

test("New goal navigates to the create screen", async () => {
  render(
    <Providers>
      <MemoryRouter initialEntries={["/goals"]}>
        <Routes>
          <Route path="/goals" element={<GoalsListPage />} />
          <Route path="*" element={<Loc />} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );
  await userEvent.click(await screen.findByRole("button", { name: "New goal" }));
  expect(await screen.findByTestId("loc")).toHaveTextContent("/goals/new");
});
