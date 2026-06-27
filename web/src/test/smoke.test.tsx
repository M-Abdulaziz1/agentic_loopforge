import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "../app/routes";

test("renders the sidebar brand", () => {
  render(
    <MemoryRouter initialEntries={["/goals"]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  expect(screen.getByText("LoopForge")).toBeInTheDocument();
});
