import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Providers } from "./Providers";
import { AppRoutes } from "./routes";

test("renders the Runs page heading at /runs", async () => {
  render(
    <Providers>
      <MemoryRouter initialEntries={["/runs"]}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
  expect(await screen.findByRole("heading", { name: "Runs" })).toBeInTheDocument();
});

test("redirects / to Goals", async () => {
  render(
    <Providers>
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
  expect(await screen.findByRole("heading", { name: "Goals" })).toBeInTheDocument();
});
