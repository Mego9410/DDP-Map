import { create } from 'zustand';
import type { ApiError } from './api';

interface SyncState {
  syncing: boolean;
  online: boolean;
  authError: ApiError | null;
  lastError: string | null;
  set: (p: Partial<Omit<SyncState, 'set'>>) => void;
}

export const useSync = create<SyncState>((set) => ({
  syncing: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  authError: null,
  lastError: null,
  set: (p) => set(p),
}));
