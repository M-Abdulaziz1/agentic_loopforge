import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Providers } from "./Providers";
import { AppRoutes } from "./routes";

test("renders the Runs page heading at /runs", () => {
  render(
    <Providers>
      <MemoryRouter initialEntries={["/runs"]}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
  expect(screen.getByRole("heading", { name: "Runs" })).toBeInTheDocument();
});

test("redirects / to Goals", () => {
  render(
    <Providers>
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
  expect(screen.getByRole("heading", { name: "Goals" })).toBeInTheDocument();
});
