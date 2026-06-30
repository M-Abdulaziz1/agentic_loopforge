import { AUTONOMY_LEVELS, gatesForAutonomy } from "./autonomy";

test("more autonomy means fewer gates (monotonic leash)", () => {
  const counts = AUTONOMY_LEVELS.map((l) => gatesForAutonomy(l).length);
  expect(counts).toEqual([3, 2, 1, 0]);
});

test("manual gates every stage; autonomous has none", () => {
  expect(gatesForAutonomy("manual")).toContain("before_training");
  expect(gatesForAutonomy("manual")).toContain("before_finalize");
  expect(gatesForAutonomy("autonomous")).toEqual([]);
});

test("finalize gate present for all but fully autonomous", () => {
  expect(gatesForAutonomy("checkpointed")).toContain("before_finalize");
  expect(gatesForAutonomy("supervised")).toEqual(["before_finalize"]);
});
