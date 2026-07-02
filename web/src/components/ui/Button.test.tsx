import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

test("fires onClick and defaults to type=button", async () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick}>Save</Button>);
  const btn = screen.getByRole("button", { name: "Save" });
  expect(btn).toHaveAttribute("type", "button");
  await userEvent.click(btn);
  expect(onClick).toHaveBeenCalledTimes(1);
});

test("loading disables the button and marks it busy", async () => {
  const onClick = vi.fn();
  render(
    <Button loading onClick={onClick}>
      Submit
    </Button>,
  );
  const btn = screen.getByRole("button", { name: "Submit" });
  expect(btn).toBeDisabled();
  expect(btn).toHaveAttribute("aria-busy", "true");
  await userEvent.click(btn);
  expect(onClick).not.toHaveBeenCalled();
});
