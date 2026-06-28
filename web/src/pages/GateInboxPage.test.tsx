import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Providers } from "../app/Providers";
import { GateInboxPage } from "./GateInboxPage";

function renderInbox() {
  return render(
    <Providers>
      <MemoryRouter>
        <GateInboxPage />
      </MemoryRouter>
    </Providers>,
  );
}

test("shows a pending gate with its context", async () => {
  renderInbox();
  expect(await screen.findByText("⛬ BEFORE_FINALIZE")).toBeInTheDocument();
  expect(screen.getByText(/3 insights passed statistical validation/)).toBeInTheDocument();
});

test("approve is clickable", async () => {
  renderInbox();
  await screen.findByText("⛬ BEFORE_FINALIZE");
  await userEvent.click(screen.getByRole("button", { name: "Approve" }));
  // mutation fired without throwing; button still in document
  expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
});
