import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Providers } from "../app/Providers";
import { AppRoutes } from "../app/routes";

test("renders the sidebar brand", () => {
  render(
    <Providers>
      <MemoryRouter initialEntries={["/goals"]}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
  expect(screen.getByText("LoopForge")).toBeInTheDocument();
});
