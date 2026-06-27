import { render, screen } from "@testing-library/react";
import { GlassCard } from "./GlassCard";

test("renders children and merges className", () => {
  render(<GlassCard className="extra">hello</GlassCard>);
  const el = screen.getByText("hello");
  expect(el).toBeInTheDocument();
  expect(el).toHaveClass("extra");
});
