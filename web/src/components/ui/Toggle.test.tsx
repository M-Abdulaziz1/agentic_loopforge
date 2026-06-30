import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toggle } from "./Toggle";

test("calls onChange with the toggled value", async () => {
  const onChange = vi.fn();
  render(<Toggle checked={false} onChange={onChange} label="Internet" />);
  await userEvent.click(screen.getByRole("switch", { name: "Internet" }));
  expect(onChange).toHaveBeenCalledWith(true);
});

test("does not fire when disabled", async () => {
  const onChange = vi.fn();
  render(<Toggle checked={false} onChange={onChange} label="Internet" disabled />);
  await userEvent.click(screen.getByRole("switch", { name: "Internet" }));
  expect(onChange).not.toHaveBeenCalled();
});
