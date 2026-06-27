import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "./routes";

test("renders the Runs page heading at /runs", () => {
  render(
    <MemoryRouter initialEntries={["/runs"]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Runs" })).toBeInTheDocument();
});

test("redirects / to Goals", () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Goals" })).toBeInTheDocument();
});
