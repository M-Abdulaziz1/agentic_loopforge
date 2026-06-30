import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Providers } from "../app/Providers";
import { SpecsListPage } from "./SpecsListPage";

test("lists loop specs linking to detail", async () => {
  render(
    <Providers>
      <MemoryRouter>
        <SpecsListPage />
      </MemoryRouter>
    </Providers>,
  );
  const link = await screen.findByRole("link", { name: /spec_churn_v1/ });
  expect(link).toHaveAttribute("href", "/specs/spec_churn_v1");
});
