import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DelegateDashboardScreen from '../screens/delegate/DelegateDashboardScreen';
import DelegateRequestDetailScreen from '../screens/delegate/DelegateRequestDetailScreen';
import DelegateProfileScreen from '../screens/delegate/DelegateProfileScreen';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Stack pour les missions
function MissionsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DelegateDashboard" component={DelegateDashboardScreen} />
      <Stack.Screen name="DelegateRequestDetail" component={DelegateRequestDetailScreen} />
    </Stack.Navigator>
  );
}

export default function DelegateNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#f59e0b', // orange pour délégués
        tabBarInactiveTintColor: '#6b7280',
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Missions"
        component={MissionsStack}
        options={{
          tabBarLabel: 'Missions Actives',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={DelegateProfileScreen}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
