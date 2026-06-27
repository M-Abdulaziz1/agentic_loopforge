import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./Sidebar";

test("marks the active item by path prefix", () => {
  render(
    <MemoryRouter>
      <Sidebar pathname="/runs/abc" />
    </MemoryRouter>,
  );
  expect(screen.getByRole("link", { name: /Runs/ })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: /Goals/ })).not.toHaveAttribute("aria-current");
});
