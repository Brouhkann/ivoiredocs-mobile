import { MD3LightTheme } from 'react-native-paper';

// Theme personnalisé avec les couleurs emerald/white/gray de l'app web
export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#10b981',        // emerald-500 (couleur principale du web)
    primaryContainer: '#d1fae5', // emerald-100
    secondary: '#f59e0b',      // amber-500 (accents oranges pour délégués)
    secondaryContainer: '#fef3c7', // amber-50
    tertiary: '#6b7280',       // gray-500
    tertiaryContainer: '#f3f4f6', // gray-100
    surface: '#ffffff',
    surfaceVariant: '#f9fafb',  // gray-50
    background: '#f9fafb',     // gray-50 (comme web)
    error: '#ef4444',          // red-500
    errorContainer: '#fee2e2', // red-100
    onPrimary: '#ffffff',
    onPrimaryContainer: '#064e3b', // emerald-900
    onSecondary: '#ffffff',
    onSecondaryContainer: '#78350f', // amber-900
    onTertiary: '#ffffff',
    onSurface: '#111827',      // gray-900
    onSurfaceVariant: '#6b7280', // gray-500
    onError: '#ffffff',
    onBackground: '#111827',   // gray-900
    outline: '#d1d5db',        // gray-300
    outlineVariant: '#e5e7eb', // gray-200
    shadow: '#000000',
    scrim: '#000000',
    inverseSurface: '#374151', // gray-700
    inverseOnSurface: '#f9fafb', // gray-50
    inversePrimary: '#6ee7b7', // emerald-300
    surfaceDisabled: 'rgba(28, 27, 31, 0.12)',
    onSurfaceDisabled: 'rgba(28, 27, 31, 0.38)',
    backdrop: 'rgba(49, 48, 51, 0.4)',
  },
  roundness: 8,
};

// Couleurs spécifiques pour les statuts de demandes
export const statusColors = {
  new: '#3b82f6',        // blue-500
  assigned: '#f59e0b',   // amber-500
  in_progress: '#8b5cf6', // purple-500
  ready: '#10b981',      // emerald-500
  shipped: '#06b6d4',    // cyan-500
  in_transit: '#2563eb', // blue-600
  delivered: '#10b981',  // emerald-500
  completed: '#22c55e',  // green-500
  cancelled: '#ef4444',  // red-500
};
