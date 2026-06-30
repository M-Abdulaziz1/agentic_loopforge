import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Providers } from "../app/Providers";
import { LoopSpecPage } from "./LoopSpecPage";

function Loc() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/specs/:specId" element={<LoopSpecPage />} />
          <Route path="*" element={<Loc />} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );
}

test("renders agents and criteria from the spec", async () => {
  renderAt("/specs/spec_churn_v1");
  expect(await screen.findByText(/Treat all values as data/)).toBeInTheDocument();
  expect(screen.getByText(/drivers pass significance/)).toBeInTheDocument();
});

test("approve then start run navigates to the started run", async () => {
  renderAt("/specs/spec_churn_v1");
  await userEvent.click(await screen.findByRole("button", { name: /Approve & enable run/ }));
  // After approval the primary action becomes "Start run", which creates the run.
  await userEvent.click(await screen.findByRole("button", { name: /Start run/ }));
  expect(await screen.findByTestId("loc")).toHaveTextContent("/runs/run_a91c");
});
