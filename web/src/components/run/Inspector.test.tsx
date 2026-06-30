import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inspector } from "./Inspector";
import type { LoopSpecAgent } from "../../lib/api/types";

const agent: LoopSpecAgent = {
  name: "analyst",
  role: "eda",
  system_prompt: "Explore distributions grounded in the profile.",
  tools: ["sandbox.exec"],
};

const noop = () => {};

test("shows the selected agent's prompt and tools", () => {
  render(
    <Inspector
      agent={agent}
      incoming={["planner"]}
      outgoing={["validator"]}
      recent={[]}
      onApprove={noop}
      onReject={noop}
    />,
  );
  expect(screen.getByText(/Explore distributions grounded/)).toBeInTheDocument();
  expect(screen.getByText("sandbox.exec")).toBeInTheDocument();
  expect(screen.getByText(/← planner/)).toBeInTheDocument();
});

test("renders a pending gate and fires approve", async () => {
  const onApprove = vi.fn();
  render(
    <Inspector
      incoming={[]}
      outgoing={[]}
      recent={[]}
      gate={{ gateType: "before_finalize", context: { validated_insights: 3, est_cost_usd: 0.08 } }}
      onApprove={onApprove}
      onReject={noop}
    />,
  );
  expect(screen.getByText("⛬ before_finalize")).toBeInTheDocument();
  expect(screen.getByText(/3 validated insights ready/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Approve" }));
  expect(onApprove).toHaveBeenCalled();
});
