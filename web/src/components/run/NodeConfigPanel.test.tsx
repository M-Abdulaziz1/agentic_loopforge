import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NodeConfigPanel } from "./NodeConfigPanel";

const base = {
  name: "analyst",
  role: "eda",
  systemPrompt: "explore",
  tools: ["sandbox.exec"],
  onRole: () => {},
  onPrompt: () => {},
  onToggleTool: () => {},
  onDelete: () => {},
};

test("toggling a tool fires onToggleTool", async () => {
  const onToggleTool = vi.fn();
  render(<NodeConfigPanel {...base} internetAllowed onToggleTool={onToggleTool} />);
  await userEvent.click(screen.getByRole("button", { name: /workspace.read/ }));
  expect(onToggleTool).toHaveBeenCalledWith("workspace.read");
});

test("internet is locked when not allowed (offline mode)", () => {
  render(<NodeConfigPanel {...base} internetAllowed={false} />);
  expect(screen.getByRole("button", { name: /internet/ })).toBeDisabled();
});
