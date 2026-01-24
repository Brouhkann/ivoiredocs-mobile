import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/user/DashboardScreen';
import ProfileScreen from '../screens/user/ProfileScreen';
import RequestDetailScreen from '../screens/user/RequestDetailScreen';
import DocumentSelectionScreen from '../screens/request/DocumentSelectionScreen';
import RequestFormScreen from '../screens/request/RequestFormScreen';
import PaymentScreen from '../screens/request/PaymentScreen';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Tab Navigator pour les écrans principaux
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#10b981', // emerald-500
        tabBarInactiveTintColor: '#6b7280', // gray-500
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Mes Demandes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
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

// Stack Navigator principal pour inclure les écrans secondaires
export default function UserNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="RequestDetail" component={RequestDetailScreen} />
      <Stack.Screen name="DocumentSelection" component={DocumentSelectionScreen} />
      <Stack.Screen name="RequestForm" component={RequestFormScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
    </Stack.Navigator>
  );
}
