import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OfflineState {
  // True while the app runs from local cache with no server. Bypasses the
  // auth gate and hides all online-only chrome. Persisted so a reload on a
  // disconnected device stays in offline mode.
  offlineMode: boolean
  setOfflineMode: (v: boolean) => void
}

export const useOffline = create<OfflineState>()(
  persist(
    (set) => ({
      offlineMode: false,
      setOfflineMode: (offlineMode) => set({ offlineMode }),
    }),
    { name: 'autism-offline' },
  ),
)
