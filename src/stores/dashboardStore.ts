import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type DashboardMode = 'user' | 'delegate' | 'driver';

interface DashboardState {
  mode: DashboardMode;
  setMode: (mode: DashboardMode) => Promise<void>;
  initializeMode: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  mode: 'user',

  setMode: async (mode: DashboardMode) => {
    try {
      await AsyncStorage.setItem('dashboardMode', mode);
      set({ mode });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du mode:', error);
    }
  },

  initializeMode: async () => {
    try {
      const savedMode = await AsyncStorage.getItem('dashboardMode');
      if (savedMode === 'user' || savedMode === 'delegate' || savedMode === 'driver') {
        set({ mode: savedMode });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du mode:', error);
    }
  },
}));
