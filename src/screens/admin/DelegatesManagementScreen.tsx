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

interface Delegate {
  id: string;
  name: string;
  city: string;
  services: string[];
  is_active: boolean;
  rating: number;
  total_requests: number;
  total_earnings: number;
}

export default function DelegatesManagementScreen({ navigation }: any) {
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [filteredDelegates, setFilteredDelegates] = useState<Delegate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    averageRating: 0,
  });

  const loadDelegates = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const { data, error } = await supabase
        .from('delegates')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      setDelegates(data || []);
      setFilteredDelegates(data || []);

      // Calculate stats
      const total = data?.length || 0;
      const active = data?.filter(d => d.is_active).length || 0;
      const totalRating = data?.reduce((sum, d) => sum + (d.rating || 0), 0) || 0;

      setStats({
        total,
        active,
        inactive: total - active,
        averageRating: total > 0 ? totalRating / total : 0,
      });
    } catch (error: any) {
      console.error('Erreur chargement délégués:', error);
      toast.error('Erreur lors du chargement des délégués');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDelegates();
  }, []);

  useEffect(() => {
    let filtered = delegates;

    // Filter by active status
    if (filterActive !== null) {
      filtered = filtered.filter(d => d.is_active === filterActive);
    }

    // Filter by search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (delegate) =>
          delegate.name.toLowerCase().includes(query) ||
          delegate.city.toLowerCase().includes(query)
      );
    }

    setFilteredDelegates(filtered);
  }, [searchQuery, filterActive, delegates]);

  const handleRefresh = useCallback(() => {
    loadDelegates(true);
  }, [loadDelegates]);

  const handleDelegatePress = (delegate: Delegate) => {
    navigation.navigate('DelegateDetails', { delegateId: delegate.id });
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
        title="Gestion des délégués"
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('PromoteDelegate')}
      >
        <Ionicons name="person-add" size={24} color="#ffffff" />
      </TouchableOpacity>

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
          <View style={[styles.statCard, { backgroundColor: '#d1fae5' }]}>
            <Ionicons name="shield-checkmark" size={24} color="#047857" />
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#dcfce7' }]}>
            <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
            <Text style={styles.statValue}>{stats.active}</Text>
            <Text style={styles.statLabel}>Actifs</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
            <Ionicons name="star" size={24} color="#d97706" />
            <Text style={styles.statValue}>{stats.averageRating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Note moy.</Text>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterActive === null && styles.filterButtonActive,
            ]}
            onPress={() => setFilterActive(null)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterActive === null && styles.filterButtonTextActive,
              ]}
            >
              Tous
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterActive === true && styles.filterButtonActive,
            ]}
            onPress={() => setFilterActive(true)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterActive === true && styles.filterButtonTextActive,
              ]}
            >
              Actifs
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterActive === false && styles.filterButtonActive,
            ]}
            onPress={() => setFilterActive(false)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterActive === false && styles.filterButtonTextActive,
              ]}
            >
              Inactifs
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher par nom ou ville..."
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

        {/* Delegates List */}
        <View style={styles.delegatesContainer}>
          <Text style={styles.sectionTitle}>
            {filteredDelegates.length} délégué{filteredDelegates.length > 1 ? 's' : ''}
          </Text>
          {filteredDelegates.map((delegate) => (
            <TouchableOpacity
              key={delegate.id}
              style={styles.delegateCard}
              onPress={() => handleDelegatePress(delegate)}
            >
              <View style={styles.delegateHeader}>
                <View style={styles.delegateAvatar}>
                  <Ionicons name="shield-checkmark" size={24} color="#047857" />
                </View>
                <View style={styles.delegateInfo}>
                  <View style={styles.delegateNameRow}>
                    <Text style={styles.delegateName}>
                      {delegate.name || 'Nom inconnu'}
                    </Text>
                    {delegate.is_active ? (
                      <Badge style={styles.badgeActive}>Actif</Badge>
                    ) : (
                      <Badge style={styles.badgeInactive}>Inactif</Badge>
                    )}
                  </View>
                  <View style={styles.delegateMetaRow}>
                    <View style={styles.delegateMeta}>
                      <Ionicons name="location" size={14} color="#6b7280" />
                      <Text style={styles.delegateMetaText}>{delegate.city}</Text>
                    </View>
                    <View style={styles.delegateMeta}>
                      <Ionicons name="star" size={14} color="#f59e0b" />
                      <Text style={styles.delegateMetaText}>
                        {delegate.rating?.toFixed(1) || '0.0'}
                      </Text>
                    </View>
                    <View style={styles.delegateMeta}>
                      <Ionicons name="briefcase" size={14} color="#6b7280" />
                      <Text style={styles.delegateMetaText}>
                        {delegate.total_requests || 0} demandes
                      </Text>
                    </View>
                  </View>
                  {delegate.services && delegate.services.length > 0 && (
                    <View style={styles.servicesContainer}>
                      {delegate.services.map((service, index) => (
                        <View key={index} style={styles.serviceTag}>
                          <Text style={styles.serviceTagText}>{service}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {filteredDelegates.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="shield-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>Aucun délégué trouvé</Text>
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
    gap: 12,
  },
  statCard: {
    flex: 1,
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
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginTop: 4,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 20,
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
  delegatesContainer: {
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
  delegateCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  delegateHeader: {
    flex: 1,
    flexDirection: 'row',
  },
  delegateAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  delegateInfo: {
    flex: 1,
  },
  delegateNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  delegateName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginRight: 8,
    flex: 1,
  },
  badgeActive: {
    backgroundColor: '#d1fae5',
    color: '#047857',
    fontSize: 10,
  },
  badgeInactive: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    fontSize: 10,
  },
  delegateEmail: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
  },
  delegateMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  delegateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  delegateMetaText: {
    fontSize: 12,
    color: '#6b7280',
  },
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  serviceTag: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  serviceTagText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 999,
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
