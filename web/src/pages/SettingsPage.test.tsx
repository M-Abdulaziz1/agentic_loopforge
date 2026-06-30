import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Providers } from "../app/Providers";
import { SettingsPage } from "./SettingsPage";

test("lists configured providers and an add form", async () => {
  render(
    <Providers>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </Providers>,
  );
  expect(await screen.findByText("Local vLLM")).toBeInTheDocument();
  expect(screen.getByText("default")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Test" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add provider" })).toBeInTheDocument();
});
