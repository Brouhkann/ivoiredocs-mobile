import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

interface StatsCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  color?: string;
}

export default function StatsCard({
  icon,
  label,
  value,
  color = '#10b981',
}: StatsCardProps) {
  return (
    <View style={[styles.container, { backgroundColor: color }]}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={14} color="#ffffff" />
      </View>
      <Text style={styles.value}>
        {value}
      </Text>
      <Text style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 6,
    borderRadius: 10,
    padding: 8,
    minHeight: 50,
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  value: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 10,
  },
});
