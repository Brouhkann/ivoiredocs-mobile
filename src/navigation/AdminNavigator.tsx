import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import ProfileScreen from '../screens/user/ProfileScreen';
import ClientsManagementScreen from '../screens/admin/ClientsManagementScreen';
import ClientDetailsScreen from '../screens/admin/ClientDetailsScreen';
import DelegatesManagementScreen from '../screens/admin/DelegatesManagementScreen';
import DelegateDetailsScreen from '../screens/admin/DelegateDetailsScreen';
import PromoteDelegateScreen from '../screens/admin/PromoteDelegateScreen';
import CitiesManagementScreen from '../screens/admin/CitiesManagementScreen';
import CityPricingScreen from '../screens/admin/CityPricingScreen';
import DocumentTypesScreen from '../screens/admin/DocumentTypesScreen';
import ServiceTypesScreen from '../screens/admin/ServiceTypesScreen';
import SupportTicketsManagementScreen from '../screens/admin/SupportTicketsManagementScreen';
import RequestsManagementScreen from '../screens/admin/RequestsManagementScreen';
import AnalyticsScreen from '../screens/admin/AnalyticsScreen';
import RequestDetailScreen from '../screens/user/RequestDetailScreen';
import PaymentsManagementScreen from '../screens/admin/PaymentsManagementScreen';
import DelegateDotationsScreen from '../screens/admin/DelegateDotationsScreen';
import CitySetupScreen from '../screens/admin/CitySetupScreen';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Tab Navigator pour les écrans principaux admin
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#dc2626', // red-600 pour admin
        tabBarInactiveTintColor: '#6b7280', // gray-500
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={AdminDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size} color={color} />
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
export default function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="ClientsManagement" component={ClientsManagementScreen} />
      <Stack.Screen name="ClientDetails" component={ClientDetailsScreen} />
      <Stack.Screen name="DelegatesManagement" component={DelegatesManagementScreen} />
      <Stack.Screen name="DelegateDetails" component={DelegateDetailsScreen} />
      <Stack.Screen name="PromoteDelegate" component={PromoteDelegateScreen} />
      <Stack.Screen name="CitiesManagement" component={CitiesManagementScreen} />
      <Stack.Screen name="CityPricing" component={CityPricingScreen} />
      <Stack.Screen name="DocumentTypes" component={DocumentTypesScreen} />
      <Stack.Screen name="ServiceTypes" component={ServiceTypesScreen} />
      <Stack.Screen name="SupportTicketsManagement" component={SupportTicketsManagementScreen} />
      <Stack.Screen name="RequestsManagement" component={RequestsManagementScreen} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} />
      <Stack.Screen name="RequestDetail" component={RequestDetailScreen} />
      <Stack.Screen name="PaymentsManagement" component={PaymentsManagementScreen} />
      <Stack.Screen name="DelegateDotations" component={DelegateDotationsScreen} />
      <Stack.Screen name="CitySetup" component={CitySetupScreen} />
    </Stack.Navigator>
  );
}
