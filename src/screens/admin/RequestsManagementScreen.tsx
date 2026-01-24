import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Text, Badge } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { toast } from '../../stores/toastStore';
import AppHeader from '../../components/AppHeader';

interface Request {
  id: string;
  document_type: string;
  status: string;
  total_amount: number;
  created_at: string;
  assigned_at: string | null;
  completed_at: string | null;
  city: string;
  users?: {
    name: string;
    email: string;
  };
  delegates?: {
    name: string;
    service_admin: string;
  };
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

const getServiceLabel = (service: string): string => {
  const serviceLabels: Record<string, string> = {
    mairie: 'Mairie',
    sous_prefecture: 'Sous-Préfecture',
    justice: 'Justice',
  };
  return serviceLabels[service] || service;
};

export default function RequestsManagementScreen({ navigation }: any) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
  });

  const loadRequests = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const { data, error } = await supabase
        .from('requests')
        .select(`
          *,
          users:user_id (
            name,
            email
          ),
          delegates:delegate_id (
            name,
            service_admin
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRequests(data || []);
      setFilteredRequests(data || []);

      // Calculate stats
      const total = data?.length || 0;
      const pending = data?.filter(r => r.status === 'new' || r.status === 'assigned').length || 0;
      const inProgress = data?.filter(r => r.status === 'in_progress').length || 0;
      const completed = data?.filter(r => r.status === 'completed').length || 0;

      setStats({
        total,
        pending,
        inProgress,
        completed,
      });
    } catch (error: any) {
      console.error('Erreur chargement demandes:', error);
      toast.error('Erreur lors du chargement des demandes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    let filtered = requests;

    // Filter by status
    if (filterStatus !== null) {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    // Filter by search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (request) =>
          request.id.toLowerCase().includes(query) ||
          request.users?.name.toLowerCase().includes(query) ||
          request.document_type.toLowerCase().includes(query) ||
          request.city.toLowerCase().includes(query)
      );
    }

    setFilteredRequests(filtered);
  }, [searchQuery, filterStatus, requests]);

  const handleRefresh = useCallback(() => {
    loadRequests(true);
  }, [loadRequests]);

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

  return (
    <View style={styles.container}>
      <AppHeader
        title="Gestion des demandes"
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
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: '#fed7aa' }]}>
            <Ionicons name="document-text" size={24} color="#ea580c" />
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fef9c3' }]}>
            <Ionicons name="time" size={24} color="#ca8a04" />
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>En attente</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#e0e7ff' }]}>
            <Ionicons name="sync" size={24} color="#4f46e5" />
            <Text style={styles.statValue}>{stats.inProgress}</Text>
            <Text style={styles.statLabel}>En cours</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#d1fae5' }]}>
            <Ionicons name="checkmark-circle" size={24} color="#059669" />
            <Text style={styles.statValue}>{stats.completed}</Text>
            <Text style={styles.statLabel}>Terminées</Text>
          </View>
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScrollView}
          contentContainerStyle={styles.filtersContainer}
        >
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterStatus === null && styles.filterButtonActive,
            ]}
            onPress={() => setFilterStatus(null)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterStatus === null && styles.filterButtonTextActive,
              ]}
            >
              Toutes
            </Text>
          </TouchableOpacity>
          {Object.entries(statusColors).map(([status, config]) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                filterStatus === status && styles.filterButtonActive,
              ]}
              onPress={() => setFilterStatus(status)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterStatus === status && styles.filterButtonTextActive,
                ]}
              >
                {config.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher par ID, nom, document ou ville..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* Requests List */}
        <View style={styles.requestsContainer}>
          <Text style={styles.sectionTitle}>
            {filteredRequests.length} demande{filteredRequests.length > 1 ? 's' : ''}
          </Text>
          {filteredRequests.map((request) => (
            <TouchableOpacity
              key={request.id}
              style={styles.requestCard}
              onPress={() => handleRequestPress(request)}
            >
              <View style={styles.requestHeader}>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColors[request.status]?.bg || '#f3f4f6' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: statusColors[request.status]?.text || '#6b7280' },
                    ]}
                  >
                    {statusColors[request.status]?.label || request.status}
                  </Text>
                </View>
                <Text style={styles.requestAmount}>
                  {request.total_amount.toLocaleString()} FCFA
                </Text>
              </View>

              <View style={styles.requestBody}>
                <Text style={styles.requestId}>#{request.id.slice(0, 8)}</Text>
                <Text style={styles.requestUser}>{request.users?.name}</Text>
                <Text style={styles.requestDocument}>{request.document_type}</Text>
                <View style={styles.requestMetaRow}>
                  <View style={styles.requestMeta}>
                    <Ionicons name="location" size={14} color="#6b7280" />
                    <Text style={styles.requestMetaText}>{request.city}</Text>
                  </View>
                  <View style={styles.requestMeta}>
                    <Ionicons name="calendar" size={14} color="#6b7280" />
                    <Text style={styles.requestMetaText}>
                      {new Date(request.created_at).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                </View>
                {request.delegates?.name && (
                  <View style={styles.delegateInfo}>
                    <Ionicons name="person" size={14} color="#047857" />
                    <Text style={styles.delegateInfoText}>
                      {request.delegates.name}
                    </Text>
                    {request.delegates.service_admin && (
                      <View style={styles.serviceTag}>
                        <Text style={styles.serviceTagText}>
                          {getServiceLabel(request.delegates.service_admin)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          ))}

          {filteredRequests.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>Aucune demande trouvée</Text>
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
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  filtersScrollView: {
    marginTop: 20,
  },
  filtersContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterButtonActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  requestsContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  requestCard: {
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
  requestHeader: {
    position: 'absolute',
    top: 12,
    right: 12,
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  requestAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  requestBody: {
    flex: 1,
    marginRight: 60,
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
  requestMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
  },
  requestMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  requestMetaText: {
    fontSize: 12,
    color: '#6b7280',
  },
  delegateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    flexWrap: 'wrap',
  },
  delegateInfoText: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
  serviceTag: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
  },
  serviceTagText: {
    fontSize: 10,
    color: '#0369a1',
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
