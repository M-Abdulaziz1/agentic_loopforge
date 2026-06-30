import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Providers } from "../app/Providers";
import { DatasetsPage } from "./DatasetsPage";

test("lists datasets with profile and an upload form", async () => {
  render(
    <Providers>
      <MemoryRouter>
        <DatasetsPage />
      </MemoryRouter>
    </Providers>,
  );
  expect(await screen.findByText("customers_q2")).toBeInTheDocument();
  expect(screen.getByText("ready")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "View profile" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Upload dataset" })).toBeInTheDocument();
});
