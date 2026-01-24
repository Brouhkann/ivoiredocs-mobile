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

interface City {
  id: string;
  name: string;
  is_active: boolean;
  shipping_cost: number;
  processing_delay_multiplier: number;
  document_prices: Record<string, number> | null;
  created_at: string;
}

export default function CitiesManagementScreen({ navigation }: any) {
  const [cities, setCities] = useState<City[]>([]);
  const [filteredCities, setFilteredCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    withPricing: 0,
  });

  const loadCities = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      setCities(data || []);
      setFilteredCities(data || []);

      // Calculate stats
      const total = data?.length || 0;
      const active = data?.filter(c => c.is_active).length || 0;
      const withPricing = data?.filter(c => c.document_prices && Object.keys(c.document_prices).length > 0).length || 0;

      setStats({
        total,
        active,
        inactive: total - active,
        withPricing,
      });
    } catch (error: any) {
      console.error('Erreur chargement villes:', error);
      toast.error('Erreur lors du chargement des villes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCities();
  }, []);

  useEffect(() => {
    let filtered = cities;

    // Filter by active status
    if (filterActive !== null) {
      filtered = filtered.filter(c => c.is_active === filterActive);
    }

    // Filter by search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(city =>
        city.name.toLowerCase().includes(query)
      );
    }

    setFilteredCities(filtered);
  }, [searchQuery, filterActive, cities]);

  const handleRefresh = useCallback(() => {
    loadCities(true);
  }, [loadCities]);

  const handleCityPress = (city: City) => {
    navigation.navigate('CityPricing', { cityId: city.id, cityName: city.name });
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
        title="Gestion des villes"
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
          <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
            <Ionicons name="location" size={24} color="#2563eb" />
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#dcfce7' }]}>
            <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
            <Text style={styles.statValue}>{stats.active}</Text>
            <Text style={styles.statLabel}>Actives</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
            <Ionicons name="pricetag" size={24} color="#d97706" />
            <Text style={styles.statValue}>{stats.withPricing}</Text>
            <Text style={styles.statLabel}>Prix définis</Text>
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
              Toutes
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
              Actives
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
              Inactives
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une ville..."
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

        {/* Cities List */}
        <View style={styles.citiesContainer}>
          <Text style={styles.sectionTitle}>
            {filteredCities.length} ville{filteredCities.length > 1 ? 's' : ''}
          </Text>
          {filteredCities.map((city) => {
            const hasPricing = city.document_prices && Object.keys(city.document_prices).length > 0;
            const priceCount = hasPricing ? Object.keys(city.document_prices).length : 0;

            return (
              <TouchableOpacity
                key={city.id}
                style={styles.cityCard}
                onPress={() => handleCityPress(city)}
              >
                <View style={styles.cityHeader}>
                  <View style={styles.cityIcon}>
                    <Ionicons name="location" size={24} color="#2563eb" />
                  </View>
                  <View style={styles.cityInfo}>
                    <View style={styles.cityNameRow}>
                      <Text style={styles.cityName}>{city.name}</Text>
                      {city.is_active ? (
                        <Badge style={styles.badgeActive}>Active</Badge>
                      ) : (
                        <Badge style={styles.badgeInactive}>Inactive</Badge>
                      )}
                    </View>
                    <View style={styles.cityMetaRow}>
                      <View style={styles.cityMeta}>
                        <Ionicons name="pricetag" size={14} color="#6b7280" />
                        <Text style={styles.cityMetaText}>
                          {priceCount} prix défini{priceCount > 1 ? 's' : ''}
                        </Text>
                      </View>
                      <View style={styles.cityMeta}>
                        <Ionicons name="boat" size={14} color="#6b7280" />
                        <Text style={styles.cityMetaText}>
                          {city.shipping_cost || 1000} FCFA
                        </Text>
                      </View>
                    </View>
                    {!hasPricing && (
                      <View style={styles.warningBanner}>
                        <Ionicons name="warning" size={14} color="#d97706" />
                        <Text style={styles.warningText}>
                          Aucun prix défini
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.cityActions}>
                  <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </View>
              </TouchableOpacity>
            );
          })}

          {filteredCities.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="location-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>Aucune ville trouvée</Text>
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
  citiesContainer: {
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
  cityCard: {
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
  cityHeader: {
    flex: 1,
    flexDirection: 'row',
  },
  cityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cityInfo: {
    flex: 1,
  },
  cityNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cityName: {
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
  cityMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
  },
  cityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cityMetaText: {
    fontSize: 12,
    color: '#6b7280',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  warningText: {
    fontSize: 11,
    color: '#d97706',
    fontWeight: '600',
  },
  cityActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
