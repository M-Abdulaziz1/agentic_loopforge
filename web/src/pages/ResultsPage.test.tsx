import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Providers } from "../app/Providers";
import { ResultsPage } from "./ResultsPage";

test("renders validated insights with stats", async () => {
  render(
    <Providers>
      <MemoryRouter initialEntries={["/runs/run_a91c/results"]}>
        <Routes>
          <Route path="/runs/:runId/results" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );
  expect(await screen.findByText(/More than 3 support tickets/)).toBeInTheDocument();
  expect(screen.getAllByText("✓ PASSED").length).toBeGreaterThan(0);
  expect(screen.getByText(/χ² independence/)).toBeInTheDocument();
});
