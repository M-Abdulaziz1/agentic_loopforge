import { lockTogglesForMode } from "./capabilities";

test("internet is forced off in offline_local mode", () => {
  const out = lockTogglesForMode(
    { internet: true, code_sandbox: true, local_connectors: true },
    "offline_local",
  );
  expect(out.internet).toBe(false);
});

test("internet is allowed (preserved) in online_enabled mode", () => {
  const out = lockTogglesForMode(
    { internet: true, code_sandbox: true, local_connectors: true },
    "online_enabled",
  );
  expect(out.internet).toBe(true);
});
