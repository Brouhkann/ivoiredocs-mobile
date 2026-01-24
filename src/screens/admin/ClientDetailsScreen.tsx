import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Text, Badge } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { toast } from '../../stores/toastStore';
import AppHeader from '../../components/AppHeader';

interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  created_at: string;
  last_sign_in_at?: string;
}

interface Request {
  id: string;
  document_type: string;
  status: string;
  total_amount: number;
  created_at: string;
  completed_at: string | null;
  city: string;
}

interface ClientStats {
  totalRequests: number;
  completedRequests: number;
  inProgressRequests: number;
  cancelledRequests: number;
  totalSpent: number;
  documentTypes: Array<{ type: string; count: number }>;
  lastRequest: Request | null;
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

export default function ClientDetailsScreen({ route, navigation }: any) {
  const { userId } = route.params;
  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [stats, setStats] = useState<ClientStats>({
    totalRequests: 0,
    completedRequests: 0,
    inProgressRequests: 0,
    cancelledRequests: 0,
    totalSpent: 0,
    documentTypes: [],
    lastRequest: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadClientData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Load user details
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) throw userError;
      setUser(userData);

      // Load user requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;
      setRequests(requestsData || []);

      // Calculate statistics
      const totalRequests = requestsData?.length || 0;
      const completedRequests = requestsData?.filter(r => r.status === 'completed').length || 0;
      const inProgressRequests = requestsData?.filter(
        r => ['assigned', 'in_progress', 'ready', 'shipped', 'delivered'].includes(r.status)
      ).length || 0;
      const cancelledRequests = requestsData?.filter(r => r.status === 'cancelled').length || 0;
      const totalSpent = requestsData
        ?.filter(r => r.status === 'completed')
        .reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0;

      // Count document types
      const docTypeCounts: Record<string, number> = {};
      requestsData?.forEach(r => {
        docTypeCounts[r.document_type] = (docTypeCounts[r.document_type] || 0) + 1;
      });
      const documentTypes = Object.entries(docTypeCounts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

      const lastRequest = requestsData?.[0] || null;

      setStats({
        totalRequests,
        completedRequests,
        inProgressRequests,
        cancelledRequests,
        totalSpent,
        documentTypes,
        lastRequest,
      });
    } catch (error: any) {
      console.error('Erreur chargement données client:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadClientData();
  }, [loadClientData]);

  const handleRefresh = useCallback(() => {
    loadClientData(true);
  }, [loadClientData]);

  const handleRequestPress = (request: Request) => {
    navigation.navigate('RequestDetail', { requestId: request.id });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Utilisateur non trouvé</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader
        title="Détails du client"
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
        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Ionicons name="person" size={48} color="#047857" />
          </View>
          <Text style={styles.profileName}>{user.name}</Text>
          <Text style={styles.profileEmail}>{user.email}</Text>
          {user.phone && <Text style={styles.profilePhone}>{user.phone}</Text>}
          <View style={styles.profileMeta}>
            <View style={styles.profileMetaItem}>
              <Ionicons name="calendar-outline" size={16} color="#6b7280" />
              <Text style={styles.profileMetaText}>
                Inscrit le {new Date(user.created_at).toLocaleDateString('fr-FR')}
              </Text>
            </View>
            {user.last_sign_in_at && (
              <View style={styles.profileMetaItem}>
                <Ionicons name="time-outline" size={16} color="#6b7280" />
                <Text style={styles.profileMetaText}>
                  Dernière connexion:{' '}
                  {new Date(user.last_sign_in_at).toLocaleDateString('fr-FR')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Statistics Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistiques</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="document-text" size={24} color="#2563eb" />
              <Text style={styles.statValue}>{stats.totalRequests}</Text>
              <Text style={styles.statLabel}>Total demandes</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#d1fae5' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#059669" />
              <Text style={styles.statValue}>{stats.completedRequests}</Text>
              <Text style={styles.statLabel}>Terminées</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="sync" size={24} color="#d97706" />
              <Text style={styles.statValue}>{stats.inProgressRequests}</Text>
              <Text style={styles.statLabel}>En cours</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="close-circle" size={24} color="#dc2626" />
              <Text style={styles.statValue}>{stats.cancelledRequests}</Text>
              <Text style={styles.statLabel}>Annulées</Text>
            </View>
          </View>

          {/* Total Spent */}
          <View style={styles.totalSpentCard}>
            <View style={styles.totalSpentIcon}>
              <Ionicons name="cash" size={32} color="#047857" />
            </View>
            <View style={styles.totalSpentInfo}>
              <Text style={styles.totalSpentLabel}>Total dépensé</Text>
              <Text style={styles.totalSpentValue}>
                {stats.totalSpent.toLocaleString()} FCFA
              </Text>
            </View>
          </View>
        </View>

        {/* Document Types */}
        {stats.documentTypes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Types de documents demandés</Text>
            {stats.documentTypes.map((doc, index) => (
              <View key={doc.type} style={styles.documentTypeCard}>
                <View style={styles.documentTypeRank}>
                  <Text style={styles.documentTypeRankText}>{index + 1}</Text>
                </View>
                <View style={styles.documentTypeInfo}>
                  <Text style={styles.documentTypeName}>{doc.type}</Text>
                  <Text style={styles.documentTypeSubtext}>
                    {doc.count} demande{doc.count > 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.documentTypeProgress}>
                  <View
                    style={[
                      styles.documentTypeProgressBar,
                      {
                        width: `${(doc.count / stats.totalRequests) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Last Request */}
        {stats.lastRequest && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dernière demande</Text>
            <TouchableOpacity
              style={styles.lastRequestCard}
              onPress={() => handleRequestPress(stats.lastRequest!)}
            >
              <View style={styles.lastRequestHeader}>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        statusColors[stats.lastRequest.status]?.bg || '#f3f4f6',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color: statusColors[stats.lastRequest.status]?.text || '#6b7280',
                      },
                    ]}
                  >
                    {statusColors[stats.lastRequest.status]?.label ||
                      stats.lastRequest.status}
                  </Text>
                </View>
                <Text style={styles.lastRequestAmount}>
                  {stats.lastRequest.total_amount.toLocaleString()} FCFA
                </Text>
              </View>
              <Text style={styles.lastRequestId}>
                #{stats.lastRequest.id.slice(0, 8)}
              </Text>
              <Text style={styles.lastRequestDocument}>
                {stats.lastRequest.document_type}
              </Text>
              <View style={styles.lastRequestMeta}>
                <View style={styles.lastRequestMetaItem}>
                  <Ionicons name="location" size={14} color="#6b7280" />
                  <Text style={styles.lastRequestMetaText}>
                    {stats.lastRequest.city}
                  </Text>
                </View>
                <View style={styles.lastRequestMetaItem}>
                  <Ionicons name="calendar" size={14} color="#6b7280" />
                  <Text style={styles.lastRequestMetaText}>
                    {new Date(stats.lastRequest.created_at).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* All Requests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Toutes les demandes ({requests.length})
          </Text>
          {requests.map((request) => (
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

          {requests.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>Aucune demande</Text>
            </View>
          )}
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
  profileEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  profilePhone: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  profileMeta: {
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },
  profileMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  profileMetaText: {
    fontSize: 12,
    color: '#6b7280',
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
    fontSize: 28,
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
  totalSpentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginTop: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#d1fae5',
  },
  totalSpentIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  totalSpentInfo: {
    flex: 1,
  },
  totalSpentLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  totalSpentValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#047857',
  },
  documentTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
  documentTypeRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentTypeRankText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
  },
  documentTypeInfo: {
    flex: 1,
  },
  documentTypeName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  documentTypeSubtext: {
    fontSize: 12,
    color: '#6b7280',
  },
  documentTypeProgress: {
    width: 80,
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  documentTypeProgressBar: {
    height: '100%',
    backgroundColor: '#047857',
  },
  lastRequestCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#d1fae5',
  },
  lastRequestHeader: {
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
  lastRequestAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },
  lastRequestId: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  lastRequestDocument: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  lastRequestMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  lastRequestMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lastRequestMetaText: {
    fontSize: 12,
    color: '#6b7280',
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
  requestDocument: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
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
