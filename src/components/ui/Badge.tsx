import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { statusColors } from '../../config/theme';
import type { RequestStatus } from '../../types';

interface BadgeProps {
  status: RequestStatus;
  label: string;
}

const statusLabels: Record<RequestStatus, string> = {
  new: 'Nouvelle',
  assigned: 'Assignée',
  in_progress: 'En cours',
  ready: 'Prête',
  shipped: 'Expédiée',
  in_transit: 'En livraison',
  delivered: 'Livrée',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

export default function Badge({ status, label }: BadgeProps) {
  const backgroundColor = statusColors[status];

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text variant="labelSmall" style={styles.text}>
        {label || statusLabels[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
