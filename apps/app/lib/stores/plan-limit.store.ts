import { create } from 'zustand';

interface PlanLimitStore {
  isOpen: boolean;
  resource: string | null;
  open: (resource: string) => void;
  close: () => void;
}

export const usePlanLimitStore = create<PlanLimitStore>((set) => ({
  isOpen: false,
  resource: null,
  open: (resource) => set({ isOpen: true, resource }),
  close: () => set({ isOpen: false, resource: null }),
}));
