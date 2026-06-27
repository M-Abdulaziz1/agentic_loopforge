import { useUiStore } from "./ui";

test("selects an agent and switches run tab", () => {
  useUiStore.getState().setSelectedAgent("analyst");
  expect(useUiStore.getState().selectedAgentId).toBe("analyst");
  useUiStore.getState().setActiveRunTab("events");
  expect(useUiStore.getState().activeRunTab).toBe("events");
});
