import { create } from "zustand";

type RunTab = "canvas" | "timeline" | "events";

type UiState = {
  selectedAgentId: string | null;
  setSelectedAgent: (id: string | null) => void;
  activeRunTab: RunTab;
  setActiveRunTab: (tab: RunTab) => void;
};

export const useUiStore = create<UiState>((set) => ({
  selectedAgentId: null,
  setSelectedAgent: (id) => set({ selectedAgentId: id }),
  activeRunTab: "canvas",
  setActiveRunTab: (tab) => set({ activeRunTab: tab }),
}));
