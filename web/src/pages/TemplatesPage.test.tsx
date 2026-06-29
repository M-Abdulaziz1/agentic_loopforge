import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Providers } from "../app/Providers";
import { TemplatesPage } from "./TemplatesPage";

test("lists templates with use/delete actions", async () => {
  render(
    <Providers>
      <MemoryRouter>
        <TemplatesPage />
      </MemoryRouter>
    </Providers>,
  );
  expect(await screen.findByText("Churn analysis loop")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Use template" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
});
