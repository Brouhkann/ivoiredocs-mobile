import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import { useDashboardStore } from '../stores/dashboardStore';
import AuthNavigator from './AuthNavigator';
import UserNavigator from './UserNavigator';
import DelegateNavigator from './DelegateNavigator';
import DriverNavigator from './DriverNavigator';
import AdminNavigator from './AdminNavigator';
import WelcomeScreen from '../screens/WelcomeScreen';
import { ActivityIndicator, View } from 'react-native';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, profile, loading } = useAuthStore();
  const { mode, initializeMode } = useDashboardStore();

  // Initialiser le mode sauvegardé au démarrage
  useEffect(() => {
    initializeMode();
  }, []);

  // Afficher un loader pendant l'initialisation
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#047857' }}>
        <ActivityIndicator size="large" color="#d4af37" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Auth" component={AuthNavigator} />
          </>
        ) : profile?.role === 'admin' || profile?.role === 'support' ? (
          // Les admins et support accèdent au dashboard admin
          <Stack.Screen name="Admin" component={AdminNavigator} />
        ) : profile?.role === 'driver' ? (
          // Les livreurs peuvent accéder aux deux dashboards
          mode === 'driver' ? (
            <Stack.Screen name="Driver" component={DriverNavigator} />
          ) : (
            <Stack.Screen name="User" component={UserNavigator} />
          )
        ) : profile?.role === 'delegate' ? (
          // Les délégués peuvent accéder aux deux dashboards
          mode === 'delegate' ? (
            <Stack.Screen name="Delegate" component={DelegateNavigator} />
          ) : (
            <Stack.Screen name="User" component={UserNavigator} />
          )
        ) : (
          // Les utilisateurs normaux accèdent uniquement au dashboard utilisateur
          <Stack.Screen name="User" component={UserNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
