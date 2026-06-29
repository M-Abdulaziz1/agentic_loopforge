import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Providers } from "../app/Providers";
import { LoopBuilderPage } from "./LoopBuilderPage";

test("loads the spec and reports a valid graph", async () => {
  render(
    <Providers>
      <MemoryRouter initialEntries={["/specs/spec_churn_v1/edit"]}>
        <Routes>
          <Route path="/specs/:specId/edit" element={<LoopBuilderPage />} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );
  // sample spec is a valid linear pipeline
  expect(await screen.findByText(/Graph is valid/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save spec" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "+ Add agent" })).toBeInTheDocument();
});
