import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Providers } from "../app/Providers";
import { EvaluatorsPage } from "./EvaluatorsPage";

test("lists evaluators with metric and an add form", async () => {
  render(
    <Providers>
      <MemoryRouter>
        <EvaluatorsPage />
      </MemoryRouter>
    </Providers>,
  );
  expect(await screen.findByText("Churn ROC-AUC beats baseline")).toBeInTheDocument();
  expect(screen.getByText("default")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add evaluator" })).toBeInTheDocument();
});
