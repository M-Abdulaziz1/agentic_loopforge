import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Providers } from "../app/Providers";
import { server } from "../test/msw";
import { sampleGoal } from "../test/fixtures";
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
  await userEvent.click(await screen.findByRole("button", { name: "+ New goal" }));
  expect(await screen.findByTestId("loc")).toHaveTextContent("/goals/new");
});

test("Delete removes a goal after confirmation (does not navigate)", async () => {
  let deletedId = "";
  server.use(
    http.delete("/api/goals/:goalId", ({ params }) => {
      deletedId = String(params.goalId);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  vi.spyOn(window, "confirm").mockReturnValue(true);

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

  await userEvent.click(await screen.findByRole("button", { name: `Delete goal ${sampleGoal.id}` }));
  await waitFor(() => expect(deletedId).toBe(sampleGoal.id));
  // Clicking Delete must not follow the card link.
  expect(screen.queryByTestId("loc")).not.toBeInTheDocument();
});

test("Delete is cancelled when the confirm dialog is dismissed", async () => {
  let called = false;
  server.use(
    http.delete("/api/goals/:goalId", () => {
      called = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  vi.spyOn(window, "confirm").mockReturnValue(false);

  render(
    <Providers>
      <MemoryRouter>
        <GoalsListPage />
      </MemoryRouter>
    </Providers>,
  );

  await userEvent.click(await screen.findByRole("button", { name: `Delete goal ${sampleGoal.id}` }));
  expect(called).toBe(false);
});
