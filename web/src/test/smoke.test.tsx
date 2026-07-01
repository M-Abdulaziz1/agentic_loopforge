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
  // Wordmark renders "Loop" + a gradient "Forge" across two nodes.
  expect(
    screen.getByText((_content, el) => el?.textContent === "LoopForge" && el.tagName === "DIV"),
  ).toBeInTheDocument();
  expect(screen.getByText("Guarded autonomy")).toBeInTheDocument();
});
