import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DriverDashboardScreen from '../screens/driver/DriverDashboardScreen';
import DriverProfileScreen from '../screens/driver/DriverProfileScreen';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export default function DriverNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="DriverDashboard"
        component={DriverDashboardScreen}
        options={{
          tabBarLabel: 'Livraisons',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bicycle" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DriverProfile"
        component={DriverProfileScreen}
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
