import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Providers } from "../app/Providers";
import { ContextPage } from "./ContextPage";

test("renders the ledger and the context pack usage", async () => {
  render(
    <Providers>
      <MemoryRouter initialEntries={["/runs/run_a91c/context"]}>
        <Routes>
          <Route path="/runs/:runId/context" element={<ContextPage />} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );
  expect(await screen.findByText(/Find churn drivers in customers_q2/)).toBeInTheDocument();
  expect(screen.getByText("SUMMARY")).toBeInTheDocument();
  expect(screen.getByText(/3.1k/)).toBeInTheDocument();
});
