import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Providers } from "../app/Providers";
import { RunsListPage } from "./RunsListPage";

test("lists runs linking to the given destination", async () => {
  render(
    <Providers>
      <MemoryRouter>
        <RunsListPage title="Results" to={(id) => `/runs/${id}/results`} />
      </MemoryRouter>
    </Providers>,
  );
  const link = await screen.findByRole("link", { name: /run_a91c/ });
  expect(link).toHaveAttribute("href", "/runs/run_a91c/results");
});
