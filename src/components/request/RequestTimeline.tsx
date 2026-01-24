import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import type { Request, RequestStatus } from '../../types';
import { statusColors } from '../../config/theme';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TimelineStep {
  status: RequestStatus;
  label: string;
  timestamp?: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

interface RequestTimelineProps {
  request: Request;
}

const statusOrder: RequestStatus[] = [
  'new',
  'assigned',
  'in_progress',
  'ready',
  'shipped',
  'delivered',
  'completed',
];

const statusLabels: Record<RequestStatus, string> = {
  new: 'Demande créée',
  assigned: 'Délégué assigné',
  in_progress: 'En cours de traitement',
  ready: 'Document prêt',
  shipped: 'Expédié',
  delivered: 'Livré',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

export default function RequestTimeline({ request }: RequestTimelineProps) {
  const currentStatusIndex = statusOrder.indexOf(request.status);

  const steps: TimelineStep[] = statusOrder.map((status, index) => ({
    status,
    label: statusLabels[status],
    timestamp: getTimestampForStatus(request, status),
    isCompleted: index <= currentStatusIndex,
    isCurrent: index === currentStatusIndex,
  }));

  return (
    <View style={styles.container}>
      {steps.map((step, index) => (
        <View key={step.status} style={styles.step}>
          {/* Ligne verticale */}
          {index > 0 && (
            <View
              style={[
                styles.line,
                step.isCompleted && styles.lineCompleted,
              ]}
            />
          )}

          {/* Icône */}
          <View
            style={[
              styles.iconContainer,
              step.isCompleted && { backgroundColor: statusColors[step.status] },
              step.isCurrent && styles.iconCurrent,
            ]}
          >
            {step.isCompleted ? (
              <Ionicons name="checkmark" size={16} color="#ffffff" />
            ) : (
              <View style={styles.iconDot} />
            )}
          </View>

          {/* Label et timestamp */}
          <View style={styles.content}>
            <Text
              variant="bodyMedium"
              style={[
                styles.label,
                step.isCurrent && styles.labelCurrent,
              ]}
            >
              {step.label}
            </Text>
            {step.timestamp && (
              <Text variant="bodySmall" style={styles.timestamp}>
                {format(new Date(step.timestamp), 'dd MMM yyyy, HH:mm', { locale: fr })}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

function getTimestampForStatus(request: Request, status: RequestStatus): string | undefined {
  switch (status) {
    case 'new':
      return request.created_at;
    case 'assigned':
      return request.assigned_at;
    case 'in_progress':
      return request.started_at;
    case 'ready':
      return request.ready_at;
    case 'shipped':
      return request.shipped_at;
    case 'delivered':
      return request.delivered_at;
    case 'completed':
      return request.completed_at;
    default:
      return undefined;
  }
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
  },
  line: {
    position: 'absolute',
    left: 15,
    top: -12,
    width: 2,
    height: 32,
    backgroundColor: '#e5e7eb',
  },
  lineCompleted: {
    backgroundColor: '#10b981',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconCurrent: {
    borderWidth: 3,
    borderColor: '#10b981',
  },
  iconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9ca3af',
  },
  content: {
    flex: 1,
    paddingBottom: 20,
  },
  label: {
    color: '#6b7280',
    marginBottom: 2,
  },
  labelCurrent: {
    color: '#111827',
    fontWeight: '600',
  },
  timestamp: {
    color: '#9ca3af',
  },
});
