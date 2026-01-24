import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Text, Badge } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { toast } from '../../stores/toastStore';
import AppHeader from '../../components/AppHeader';

interface Delegate {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  services: string[];
  is_active: boolean;
  rating: number;
  total_requests: number;
  total_earnings: number;
}

interface Request {
  id: string;
  document_type: string;
  status: string;
  total_amount: number;
  created_at: string;
  completed_at: string | null;
  city: string;
  users?: {
    name: string;
  };
}

interface DelegateStats {
  totalMissions: number;
  inProgressMissions: number;
  completedMissions: number;
  totalEarnings: number;
  averageRating: number;
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  new: { bg: '#dbeafe', text: '#1e40af', label: 'Nouvelle' },
  assigned: { bg: '#fef3c7', text: '#92400e', label: 'Assignée' },
  in_progress: { bg: '#e0e7ff', text: '#3730a3', label: 'En cours' },
  ready: { bg: '#e9d5ff', text: '#6b21a8', label: 'Prête' },
  shipped: { bg: '#fce7f3', text: '#9f1239', label: 'Expédiée' },
  delivered: { bg: '#dcfce7', text: '#166534', label: 'Livrée' },
  completed: { bg: '#d1fae5', text: '#065f46', label: 'Terminée' },
  cancelled: { bg: '#fee2e2', text: '#991b1b', label: 'Annulée' },
};

export default function DelegateDetailsScreen({ route, navigation }: any) {
  const { delegateId } = route.params;
  const [delegate, setDelegate] = useState<Delegate | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [inProgressRequests, setInProgressRequests] = useState<Request[]>([]);
  const [completedRequests, setCompletedRequests] = useState<Request[]>([]);
  const [stats, setStats] = useState<DelegateStats>({
    totalMissions: 0,
    inProgressMissions: 0,
    completedMissions: 0,
    totalEarnings: 0,
    averageRating: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDelegateData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Load delegate details
      const { data: delegateData, error: delegateError } = await supabase
        .from('delegates')
        .select('*')
        .eq('id', delegateId)
        .single();

      if (delegateError) throw delegateError;
      setDelegate(delegateData);

      // Load delegate requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('requests')
        .select(`
          *,
          users:user_id (
            name
          )
        `)
        .eq('delegate_id', delegateId)
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;
      setRequests(requestsData || []);

      // Separate requests by status
      const inProgress = requestsData?.filter(
        r => ['assigned', 'in_progress', 'ready', 'shipped', 'delivered'].includes(r.status)
      ) || [];
      const completed = requestsData?.filter(r => r.status === 'completed') || [];

      setInProgressRequests(inProgress);
      setCompletedRequests(completed);

      // Calculate statistics
      const totalMissions = requestsData?.length || 0;
      const totalEarnings = requestsData
        ?.filter(r => r.status === 'completed')
        .reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0;

      setStats({
        totalMissions,
        inProgressMissions: inProgress.length,
        completedMissions: completed.length,
        totalEarnings,
        averageRating: delegateData?.rating || 0,
      });
    } catch (error: any) {
      console.error('Erreur chargement données délégué:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [delegateId]);

  useEffect(() => {
    loadDelegateData();
  }, [loadDelegateData]);

  const handleRefresh = useCallback(() => {
    loadDelegateData(true);
  }, [loadDelegateData]);

  const handleRequestPress = (request: Request) => {
    navigation.navigate('RequestDetail', { requestId: request.id });
  };

  const handleCall = () => {
    if (!delegate?.phone) {
      toast.error('Numéro de téléphone non disponible');
      return;
    }
    Linking.openURL(`tel:${delegate.phone}`);
  };

  const handleWhatsApp = () => {
    if (!delegate?.phone) {
      toast.error('Numéro de téléphone non disponible');
      return;
    }
    // Remove any spaces or special characters from phone number
    const cleanPhone = delegate.phone.replace(/\s+/g, '');
    Linking.openURL(`whatsapp://send?phone=${cleanPhone}`);
  };

  const handleToggleActive = async () => {
    if (!delegate) return;

    try {
      const { error } = await supabase
        .from('delegates')
        .update({ is_active: !delegate.is_active })
        .eq('id', delegate.id);

      if (error) throw error;

      toast.success(
        delegate.is_active ? 'Délégué désactivé' : 'Délégué activé'
      );
      loadDelegateData();
    } catch (error: any) {
      console.error('Erreur mise à jour délégué:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  if (!delegate) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Délégué non trouvé</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader
        title="Détails du délégué"
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#047857']}
            tintColor="#047857"
          />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Ionicons name="shield-checkmark" size={48} color="#047857" />
          </View>
          <Text style={styles.profileName}>{delegate.name}</Text>
          <View style={styles.statusBadgeContainer}>
            {delegate.is_active ? (
              <Badge style={styles.badgeActive}>Actif</Badge>
            ) : (
              <Badge style={styles.badgeInactive}>Inactif</Badge>
            )}
          </View>

          {/* Contact Information */}
          <View style={styles.contactInfo}>
            <View style={styles.contactItem}>
              <Ionicons name="mail" size={16} color="#047857" />
              <Text style={styles.contactText}>{delegate.email || 'Non disponible'}</Text>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="call" size={16} color="#047857" />
              <Text style={styles.contactText}>{delegate.phone || 'Non disponible'}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.callButton} onPress={handleCall}>
              <Ionicons name="call" size={20} color="#ffffff" />
              <Text style={styles.callButtonText}>Appeler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.whatsappButton} onPress={handleWhatsApp}>
              <Ionicons name="logo-whatsapp" size={20} color="#ffffff" />
              <Text style={styles.whatsappButtonText}>WhatsApp</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.profileMeta}>
            <View style={styles.profileMetaItem}>
              <Ionicons name="location" size={16} color="#6b7280" />
              <Text style={styles.profileMetaText}>{delegate.city}</Text>
            </View>
            <View style={styles.profileMetaItem}>
              <Ionicons name="star" size={16} color="#f59e0b" />
              <Text style={styles.profileMetaText}>
                {delegate.rating.toFixed(1)} / 5.0
              </Text>
            </View>
          </View>

          {/* Services */}
          {delegate.services && delegate.services.length > 0 && (
            <View style={styles.servicesContainer}>
              <Text style={styles.servicesTitle}>Services</Text>
              <View style={styles.servicesTagsContainer}>
                {delegate.services.map((service, index) => (
                  <View key={index} style={styles.serviceTag}>
                    <Text style={styles.serviceTagText}>{service}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Statistics Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistiques</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="briefcase" size={24} color="#2563eb" />
              <Text style={styles.statValue}>{stats.totalMissions}</Text>
              <Text style={styles.statLabel}>Total missions</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="sync" size={24} color="#d97706" />
              <Text style={styles.statValue}>{stats.inProgressMissions}</Text>
              <Text style={styles.statLabel}>En cours</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#d1fae5' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#059669" />
              <Text style={styles.statValue}>{stats.completedMissions}</Text>
              <Text style={styles.statLabel}>Terminées</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#e0f2fe' }]}>
              <Ionicons name="cash" size={24} color="#0284c7" />
              <Text style={styles.statValue}>
                {(stats.totalEarnings / 1000).toFixed(0)}K
              </Text>
              <Text style={styles.statLabel}>Revenus (FCFA)</Text>
            </View>
          </View>
        </View>

        {/* Missions en cours */}
        {inProgressRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Missions en cours ({inProgressRequests.length})
            </Text>
            {inProgressRequests.map((request) => (
              <TouchableOpacity
                key={request.id}
                style={styles.requestCard}
                onPress={() => handleRequestPress(request)}
              >
                <View style={styles.requestHeader}>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: statusColors[request.status]?.bg || '#f3f4f6',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        {
                          color: statusColors[request.status]?.text || '#6b7280',
                        },
                      ]}
                    >
                      {statusColors[request.status]?.label || request.status}
                    </Text>
                  </View>
                  <Text style={styles.requestAmount}>
                    {request.total_amount.toLocaleString()} FCFA
                  </Text>
                </View>
                <Text style={styles.requestId}>#{request.id.slice(0, 8)}</Text>
                <Text style={styles.requestUser}>{request.users?.name}</Text>
                <Text style={styles.requestDocument}>{request.document_type}</Text>
                <View style={styles.requestMeta}>
                  <View style={styles.requestMetaItem}>
                    <Ionicons name="location" size={14} color="#6b7280" />
                    <Text style={styles.requestMetaText}>{request.city}</Text>
                  </View>
                  <View style={styles.requestMetaItem}>
                    <Ionicons name="calendar" size={14} color="#6b7280" />
                    <Text style={styles.requestMetaText}>
                      {new Date(request.created_at).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Missions terminées */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Missions terminées ({completedRequests.length})
          </Text>
          {completedRequests.map((request) => (
            <TouchableOpacity
              key={request.id}
              style={styles.requestCard}
              onPress={() => handleRequestPress(request)}
            >
              <View style={styles.requestHeader}>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: statusColors[request.status]?.bg || '#f3f4f6',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color: statusColors[request.status]?.text || '#6b7280',
                      },
                    ]}
                  >
                    {statusColors[request.status]?.label || request.status}
                  </Text>
                </View>
                <Text style={styles.requestAmount}>
                  {request.total_amount.toLocaleString()} FCFA
                </Text>
              </View>
              <Text style={styles.requestId}>#{request.id.slice(0, 8)}</Text>
              <Text style={styles.requestUser}>{request.users?.name}</Text>
              <Text style={styles.requestDocument}>{request.document_type}</Text>
              <View style={styles.requestMeta}>
                <View style={styles.requestMetaItem}>
                  <Ionicons name="location" size={14} color="#6b7280" />
                  <Text style={styles.requestMetaText}>{request.city}</Text>
                </View>
                <View style={styles.requestMetaItem}>
                  <Ionicons name="calendar" size={14} color="#6b7280" />
                  <Text style={styles.requestMetaText}>
                    {new Date(request.created_at).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
              </View>
              {request.completed_at && (
                <View style={styles.completedInfo}>
                  <Ionicons name="checkmark-circle" size={14} color="#059669" />
                  <Text style={styles.completedInfoText}>
                    Terminée le {new Date(request.completed_at).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}

          {completedRequests.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-done-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>Aucune mission terminée</Text>
            </View>
          )}
        </View>

        {/* Discrete Toggle Active Button */}
        <View style={styles.dangerZone}>
          <TouchableOpacity
            style={styles.discreteToggleButton}
            onPress={handleToggleActive}
          >
            <Text style={styles.discreteToggleButtonText}>
              {delegate.is_active ? 'Désactiver le délégué' : 'Activer le délégué'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  profileAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusBadgeContainer: {
    marginBottom: 16,
  },
  badgeActive: {
    backgroundColor: '#d1fae5',
    color: '#047857',
  },
  badgeInactive: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
  },
  contactInfo: {
    width: '100%',
    marginBottom: 16,
    gap: 10,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  profileMeta: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  profileMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileMetaText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  servicesContainer: {
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  servicesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  servicesTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceTag: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  serviceTagText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 16,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  callButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  whatsappButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  whatsappButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  dangerZone: {
    paddingHorizontal: 20,
    marginTop: 40,
    marginBottom: 20,
  },
  discreteToggleButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: 'transparent',
  },
  discreteToggleButtonText: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  statCard: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    textAlign: 'center',
  },
  requestCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  requestAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  requestId: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  requestUser: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  requestDocument: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
  },
  requestMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  requestMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  requestMetaText: {
    fontSize: 12,
    color: '#6b7280',
  },
  completedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  completedInfoText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
});
