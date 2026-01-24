import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from './src/config/theme';
import RootNavigator from './src/navigation/RootNavigator';
import { useAuthStore } from './src/stores/authStore';

export default function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  // Initialiser l'authentification au démarrage
  useEffect(() => {
    initializeAuth();
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar style="auto" />
        <RootNavigator />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
