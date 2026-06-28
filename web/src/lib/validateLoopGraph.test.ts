import { validateLoopGraph } from "./validateLoopGraph";

const linear = [
  { from: "planner", to: "analyst" },
  { from: "analyst", to: "validator" },
  { from: "validator", to: "reporter" },
];

test("a valid linear pipeline has no errors", () => {
  const errs = validateLoopGraph(
    ["planner", "analyst", "validator", "reporter"],
    linear,
  );
  expect(errs).toEqual([]);
});

test("empty graph reports EMPTY", () => {
  expect(validateLoopGraph([], []).map((e) => e.code)).toEqual(["EMPTY"]);
});

test("handoff to an unknown agent reports UNKNOWN_ENDPOINT", () => {
  const errs = validateLoopGraph(["a", "b"], [{ from: "a", to: "ghost" }]);
  expect(errs.map((e) => e.code)).toContain("UNKNOWN_ENDPOINT");
});

test("a self-loop is rejected", () => {
  const errs = validateLoopGraph(["a", "b"], [{ from: "a", to: "a" }, { from: "a", to: "b" }]);
  expect(errs.map((e) => e.code)).toContain("SELF_LOOP");
});

test("an isolated agent reports ORPHAN", () => {
  const errs = validateLoopGraph(["a", "b", "loner"], [{ from: "a", to: "b" }]);
  expect(errs.map((e) => e.code)).toContain("ORPHAN");
});

test("a cycle with no entry reports NO_ENTRY", () => {
  const errs = validateLoopGraph(["a", "b"], [{ from: "a", to: "b" }, { from: "b", to: "a" }]);
  const codes = errs.map((e) => e.code);
  expect(codes).toContain("NO_ENTRY");
  expect(codes).toContain("NO_TERMINAL");
});
