import { create } from 'zustand';
import { LOCAL_ONLY, LOCAL_USER } from '../config';
import type { SessionUser } from '../shared/types';
import { api, ApiError, OfflineError } from './api';
import { clearAll, getMeta, META, setMeta } from './db';
import { useSync } from './syncState';

type Status = 'loading' | 'signed-out' | 'signed-in';

interface SessionState {
  status: Status;
  user: SessionUser | null;
  /** Inline message for the login screen. */
  message: string | null;
  boot: () => Promise<void>;
  signIn: (email: string, passcode: string) => Promise<void>;
  signOut: () => Promise<void>;
  expire: (message: string, forget: boolean) => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  user: null,
  message: null,

  async boot() {
    if (LOCAL_ONLY) {
      set({ status: 'signed-in', user: LOCAL_USER });
      return;
    }
    const cached = await getMeta<SessionUser>(META.user);
    try {
      const { user } = await api.me();
      await setMeta(META.user, user);
      useSync.getState().set({ authError: null });
      set({ status: 'signed-in', user, message: null });
    } catch (e) {
      if (e instanceof OfflineError && cached) {
        // No signal in the park: keep using what's saved on the phone.
        set({ status: 'signed-in', user: cached });
      } else if (e instanceof ApiError && e.status === 403) {
        await clearAll();
        set({ status: 'signed-out', user: null, message: e.message });
      } else if (e instanceof ApiError && e.status === 401) {
        set({ status: 'signed-out', user: null, message: cached ? 'Your session ended. Sign in again.' : null });
      } else {
        set({ status: 'signed-out', user: null, message: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  async signIn(email, passcode) {
    set({ message: null });
    try {
      const { user } = await api.login(email, passcode);
      const prev = await getMeta<SessionUser>(META.user);
      if (prev && prev.email !== user.email) await clearAll();
      await setMeta(META.user, user);
      useSync.getState().set({ authError: null });
      set({ status: 'signed-in', user, message: null });
    } catch (e) {
      set({ message: e instanceof OfflineError ? 'No connection. Sign in once on Wi-Fi.' : e instanceof Error ? e.message : String(e) });
    }
  },

  async signOut() {
    try {
      await api.logout();
    } catch {
      // Clearing local data is what matters.
    }
    await clearAll();
    set({ status: 'signed-out', user: null, message: 'Signed out.' });
  },

  async expire(message, forget) {
    if (forget) await clearAll();
    set({ status: 'signed-out', user: null, message });
  },
}));
