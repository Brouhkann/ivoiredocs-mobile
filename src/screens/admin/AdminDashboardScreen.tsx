import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Avatar, Badge } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../config/supabase';
import { toast } from '../../stores/toastStore';
import AppHeader from '../../components/AppHeader';
import { getCitySearchStats, type CitySearchStats } from '../../services/citySearchService';
import { getPendingInvoices } from '../../services/wavePaymentService';

interface AdminStats {
  totalUsers: number;
  newUsersToday: number;
  activeUsersLast30Days: number;
  totalDelegates: number;
  activeDelegates: number;
  delegatesOffline: number;
  averageDelegateRating: number;
  totalRequests: number;
  pendingRequests: number;
  completedToday: number;
  averageProcessingTime: number;
  totalRevenue: number;
  revenueToday: number;
  successRate: number;
  customerSatisfaction: number;
}

interface Alert {
  id: string;
  type: 'urgent' | 'warning' | 'info';
  title: string;
  message: string;
  count?: number;
}

export default function AdminDashboardScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    newUsersToday: 0,
    activeUsersLast30Days: 0,
    totalDelegates: 0,
    activeDelegates: 0,
    delegatesOffline: 0,
    averageDelegateRating: 0,
    totalRequests: 0,
    pendingRequests: 0,
    completedToday: 0,
    averageProcessingTime: 0,
    totalRevenue: 0,
    revenueToday: 0,
    successRate: 0,
    customerSatisfaction: 0,
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [citySearches, setCitySearches] = useState<CitySearchStats[]>([]);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const loadDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      }

      await Promise.all([
        loadUserStats(),
        loadDelegateStats(),
        loadRequestStats(),
        loadRevenueStats(),
        loadAlerts(),
        loadCitySearches(),
        loadPendingPayments(),
      ]);

      setLastUpdate(new Date());
    } catch (error: any) {
      console.error('Erreur chargement données admin:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadUserStats = async () => {
    const { data: users } = await supabase
      .from('users')
      .select('created_at, role')
      .eq('role', 'user');

    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const totalUsers = users?.length || 0;
    const newUsersToday = users?.filter(u => u.created_at.startsWith(today)).length || 0;
    const activeUsersLast30Days = users?.filter(u => u.created_at >= thirtyDaysAgo).length || 0;

    setStats(prev => ({
      ...prev,
      totalUsers,
      newUsersToday,
      activeUsersLast30Days,
    }));
  };

  const loadDelegateStats = async () => {
    const { data: delegates } = await supabase
      .from('delegates')
      .select('*, is_active');

    const { data: ratings } = await supabase
      .from('delegate_ratings')
      .select('overall_rating');

    const totalDelegates = delegates?.length || 0;
    const activeDelegates = delegates?.filter(d => d.is_active).length || 0;
    const delegatesOffline = totalDelegates - activeDelegates;
    const averageDelegateRating = ratings?.length > 0
      ? ratings.reduce((sum, r) => sum + r.overall_rating, 0) / ratings.length
      : 0;

    setStats(prev => ({
      ...prev,
      totalDelegates,
      activeDelegates,
      delegatesOffline,
      averageDelegateRating: Math.round(averageDelegateRating * 10) / 10,
    }));
  };

  const loadRequestStats = async () => {
    const { data: requests } = await supabase
      .from('requests')
      .select('status, created_at, assigned_at, completed_at');

    const today = new Date().toISOString().split('T')[0];

    const totalRequests = requests?.length || 0;
    const pendingRequests = requests?.filter(r => r.status === 'new' || r.status === 'assigned').length || 0;
    const completedToday = requests?.filter(r =>
      r.status === 'completed' && r.completed_at?.startsWith(today)
    ).length || 0;

    const completedRequests = requests?.filter(r => r.completed_at && r.assigned_at) || [];
    const averageProcessingTime = completedRequests.length > 0
      ? completedRequests.reduce((sum, r) => {
          const assigned = new Date(r.assigned_at!).getTime();
          const completed = new Date(r.completed_at!).getTime();
          return sum + (completed - assigned) / (1000 * 60 * 60);
        }, 0) / completedRequests.length
      : 0;

    const successRate = totalRequests > 0
      ? (requests.filter(r => r.status === 'completed').length / totalRequests) * 100
      : 0;

    setStats(prev => ({
      ...prev,
      totalRequests,
      pendingRequests,
      completedToday,
      averageProcessingTime: Math.round(averageProcessingTime),
      successRate: Math.round(successRate),
    }));
  };

  const loadRevenueStats = async () => {
    const { data: requests } = await supabase
      .from('requests')
      .select('total_amount, completed_at, status');

    const today = new Date().toISOString().split('T')[0];

    const completedRequests = requests?.filter(r => r.status === 'completed') || [];
    const totalRevenue = completedRequests.reduce((sum, r) => sum + (r.total_amount || 0), 0);

    const revenueToday = completedRequests
      .filter(r => r.completed_at?.startsWith(today))
      .reduce((sum, r) => sum + (r.total_amount || 0), 0);

    setStats(prev => ({
      ...prev,
      totalRevenue,
      revenueToday,
      customerSatisfaction: 85,
    }));
  };

  const loadAlerts = async () => {
    const alertsData: Alert[] = [];

    // Demandes en retard
    const { data: overdueRequests } = await supabase
      .from('requests')
      .select('id, assigned_at')
      .in('status', ['assigned', 'in_progress'])
      .not('assigned_at', 'is', null);

    const now = new Date().getTime();
    const fortyEightHours = 48 * 60 * 60 * 1000;

    const overdueCount = overdueRequests?.filter(request => {
      if (request.assigned_at) {
        const assignedTime = new Date(request.assigned_at).getTime();
        return now - assignedTime > fortyEightHours;
      }
      return false;
    }).length || 0;

    if (overdueCount > 0) {
      alertsData.push({
        id: 'overdue_requests',
        type: 'urgent',
        title: 'Demandes en retard',
        message: `${overdueCount} demande${overdueCount > 1 ? 's' : ''} en cours depuis plus de 48h`,
        count: overdueCount,
      });
    }

    // Demandes non assignées
    const { data: unassignedRequests } = await supabase
      .from('requests')
      .select('id, created_at')
      .eq('status', 'new')
      .is('delegate_id', null);

    const unassignedCount = unassignedRequests?.filter(request => {
      const createdTime = new Date(request.created_at).getTime();
      return now - createdTime > 2 * 60 * 60 * 1000;
    }).length || 0;

    if (unassignedCount > 0) {
      alertsData.push({
        id: 'unassigned_requests',
        type: 'warning',
        title: 'Demandes non assignées',
        message: `${unassignedCount} demande${unassignedCount > 1 ? 's' : ''} en attente d'assignation`,
        count: unassignedCount,
      });
    }

    setAlerts(alertsData);
  };

  const loadCitySearches = async () => {
    const result = await getCitySearchStats();
    if (result.success) {
      setCitySearches(result.data);
    }
  };

  const loadPendingPayments = async () => {
    try {
      const invoices = await getPendingInvoices();
      setPendingPaymentsCount(invoices.length);
    } catch (error) {
      console.error('Erreur chargement paiements en attente:', error);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleRefresh = useCallback(() => {
    loadDashboardData(true);
  }, [loadDashboardData]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <AppHeader
        userName={profile?.name?.split(' ')[0] || 'Admin'}
        showLogo={true}
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
        {/* Dernière mise à jour */}
        <View style={styles.updateInfo}>
          <Ionicons name="time-outline" size={14} color="#6b7280" />
          <Text style={styles.updateText}>
            Dernière mise à jour: {lastUpdate.toLocaleTimeString('fr-FR')}
          </Text>
        </View>

        {/* Alerte Paiements Wave */}
        {pendingPaymentsCount > 0 && (
          <TouchableOpacity
            style={styles.paymentAlertCard}
            onPress={() => navigation.navigate('PaymentsManagement')}
          >
            <View style={styles.paymentAlertIconContainer}>
              <Ionicons name="cash" size={24} color="#ffffff" />
            </View>
            <View style={styles.paymentAlertContent}>
              <Text style={styles.paymentAlertTitle}>Paiements Wave en attente</Text>
              <Text style={styles.paymentAlertMessage}>
                {pendingPaymentsCount} facture{pendingPaymentsCount > 1 ? 's' : ''} à traiter
              </Text>
            </View>
            <Badge style={styles.paymentAlertBadge}>{pendingPaymentsCount}</Badge>
            <Ionicons name="chevron-forward" size={20} color="#ffffff" />
          </TouchableOpacity>
        )}

        {/* Alertes */}
        {alerts.length > 0 && (
          <View style={styles.alertsSection}>
            <Text style={styles.sectionTitle}>Alertes importantes</Text>
            {alerts.map((alert) => (
              <TouchableOpacity
                key={alert.id}
                style={[
                  styles.alertCard,
                  alert.type === 'urgent' && styles.alertCardUrgent,
                  alert.type === 'warning' && styles.alertCardWarning,
                ]}
                onPress={() => navigation.navigate('RequestsManagement')}
              >
                <View style={styles.alertIconContainer}>
                  <Ionicons
                    name={alert.type === 'urgent' ? 'alert-circle' : 'warning'}
                    size={20}
                    color={alert.type === 'urgent' ? '#dc2626' : '#f59e0b'}
                  />
                </View>
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                </View>
                {alert.count && (
                  <Badge style={[
                    styles.alertBadge,
                    alert.type === 'urgent' && styles.alertBadgeUrgent,
                  ]}>
                    {alert.count}
                  </Badge>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Statistiques principales - Section Utilisateurs */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Utilisateurs</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.statCardInner, { backgroundColor: '#dbeafe' }]}>
              <View style={styles.statIconContainer}>
                <Ionicons name="people" size={18} color="#2563eb" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{stats.totalUsers}</Text>
                <Text style={styles.statLabel}>Total</Text>
                <Text style={styles.statSubLabel}>+{stats.newUsersToday} aujourd'hui</Text>
              </View>
            </View>

            <View style={[styles.statCard, styles.statCardInner, { backgroundColor: '#dcfce7' }]}>
              <View style={styles.statIconContainer}>
                <Ionicons name="person-add" size={18} color="#16a34a" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{stats.activeUsersLast30Days}</Text>
                <Text style={styles.statLabel}>Actifs 30j</Text>
                <Text style={styles.statSubLabel}>Utilisateurs récents</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Statistiques Délégués */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Délégués</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.statCardInner, { backgroundColor: '#d1fae5' }]}>
              <View style={styles.statIconContainer}>
                <Ionicons name="shield-checkmark" size={18} color="#047857" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{stats.activeDelegates}</Text>
                <Text style={styles.statLabel}>Actifs</Text>
                <Text style={styles.statSubLabel}>/{stats.totalDelegates} total</Text>
              </View>
            </View>

            <View style={[styles.statCard, styles.statCardInner, { backgroundColor: '#fef3c7' }]}>
              <View style={styles.statIconContainer}>
                <Ionicons name="star" size={18} color="#d97706" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{stats.averageDelegateRating.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Note moyenne</Text>
                <Text style={styles.statSubLabel}>Sur 5 étoiles</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Statistiques Demandes */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Demandes</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.statCardInner, { backgroundColor: '#fed7aa' }]}>
              <View style={styles.statIconContainer}>
                <Ionicons name="document-text" size={18} color="#ea580c" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{stats.totalRequests}</Text>
                <Text style={styles.statLabel}>Total</Text>
                <Text style={styles.statSubLabel}>Toutes demandes</Text>
              </View>
            </View>

            <View style={[styles.statCard, styles.statCardInner, { backgroundColor: '#fef9c3' }]}>
              <View style={styles.statIconContainer}>
                <Ionicons name="time" size={18} color="#ca8a04" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{stats.pendingRequests}</Text>
                <Text style={styles.statLabel}>En attente</Text>
                <Text style={styles.statSubLabel}>{stats.completedToday} terminées</Text>
              </View>
            </View>

            <View style={[styles.statCard, styles.statCardInner, { backgroundColor: '#e0e7ff' }]}>
              <View style={styles.statIconContainer}>
                <Ionicons name="speedometer" size={18} color="#4f46e5" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{stats.averageProcessingTime}h</Text>
                <Text style={styles.statLabel}>Temps moyen</Text>
                <Text style={styles.statSubLabel}>Traitement</Text>
              </View>
            </View>

            <View style={[styles.statCard, styles.statCardInner, { backgroundColor: '#d1fae5' }]}>
              <View style={styles.statIconContainer}>
                <Ionicons name="checkmark-circle" size={18} color="#059669" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{stats.successRate}%</Text>
                <Text style={styles.statLabel}>Taux de succès</Text>
                <Text style={styles.statSubLabel}>Demandes terminées</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Statistiques Revenus */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Revenus</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.statCardInner, { backgroundColor: '#e0f2fe' }]}>
              <View style={styles.statIconContainer}>
                <Ionicons name="cash" size={18} color="#0284c7" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{(stats.totalRevenue / 1000).toFixed(0)}K</Text>
                <Text style={styles.statLabel}>Total</Text>
                <Text style={styles.statSubLabel}>FCFA</Text>
              </View>
            </View>

            <View style={[styles.statCard, styles.statCardInner, { backgroundColor: '#fce7f3' }]}>
              <View style={styles.statIconContainer}>
                <Ionicons name="trending-up" size={18} color="#db2777" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{stats.revenueToday.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Aujourd'hui</Text>
                <Text style={styles.statSubLabel}>FCFA</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Actions rapides */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Actions rapides</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('PaymentsManagement')}>
              <View style={[styles.actionIcon, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="cash" size={28} color="#1d4ed8" />
                {pendingPaymentsCount > 0 && (
                  <View style={styles.actionBadge}>
                    <Text style={styles.actionBadgeText}>{pendingPaymentsCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.actionLabel}>Paiements</Text>
              <Text style={styles.actionSubLabel}>Wave</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ClientsManagement')}>
              <View style={[styles.actionIcon, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="people" size={28} color="#2563eb" />
              </View>
              <Text style={styles.actionLabel}>Clients</Text>
              <Text style={styles.actionSubLabel}>Gestion</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('DelegatesManagement')}>
              <View style={[styles.actionIcon, { backgroundColor: '#d1fae5' }]}>
                <Ionicons name="shield-checkmark" size={28} color="#047857" />
              </View>
              <Text style={styles.actionLabel}>Délégués</Text>
              <Text style={styles.actionSubLabel}>Missions</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('RequestsManagement')}>
              <View style={[styles.actionIcon, { backgroundColor: '#fed7aa' }]}>
                <Ionicons name="document-text" size={28} color="#ea580c" />
              </View>
              <Text style={styles.actionLabel}>Demandes</Text>
              <Text style={styles.actionSubLabel}>Suivi</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Analytics')}>
              <View style={[styles.actionIcon, { backgroundColor: '#e9d5ff' }]}>
                <Ionicons name="bar-chart" size={28} color="#9333ea" />
              </View>
              <Text style={styles.actionLabel}>Analytics</Text>
              <Text style={styles.actionSubLabel}>Rapports</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('DelegateDotations')}>
              <View style={[styles.actionIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="wallet" size={28} color="#f59e0b" />
              </View>
              <Text style={styles.actionLabel}>Dotations</Text>
              <Text style={styles.actionSubLabel}>Délégués</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ZonesManagement')}>
              <View style={[styles.actionIcon, { backgroundColor: '#e0f2fe' }]}>
                <Ionicons name="map" size={28} color="#0284c7" />
              </View>
              <Text style={styles.actionLabel}>Zones</Text>
              <Text style={styles.actionSubLabel}>Secteurs</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('DriversManagement')}>
              <View style={[styles.actionIcon, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="bicycle" size={28} color="#2563eb" />
              </View>
              <Text style={styles.actionLabel}>Livreurs</Text>
              <Text style={styles.actionSubLabel}>Express</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bouton configuration ville */}
        <TouchableOpacity
          style={styles.citySetupButton}
          onPress={() => navigation.navigate('CitySetup')}
        >
          <View style={styles.citySetupIcon}>
            <Ionicons name="add-circle" size={28} color="#fff" />
          </View>
          <View style={styles.citySetupContent}>
            <Text style={styles.citySetupTitle}>Configurer une nouvelle ville</Text>
            <Text style={styles.citySetupSubtitle}>
              Ville + Services + Tarifs + Délégué en une seule étape
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#047857" />
        </TouchableOpacity>

        {/* Administration */}
        <View style={styles.adminSection}>
          <Text style={styles.sectionTitle}>Administration</Text>
          <View style={styles.adminGrid}>
            <TouchableOpacity style={styles.adminCard} onPress={() => navigation.navigate('CitiesManagement')}>
              <Ionicons name="location" size={20} color="#047857" />
              <Text style={styles.adminLabel}>Villes</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.adminCard} onPress={() => navigation.navigate('DelegatesManagement')}>
              <Ionicons name="people" size={20} color="#047857" />
              <Text style={styles.adminLabel}>Délégués</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.adminCard} onPress={() => navigation.navigate('DocumentTypes')}>
              <Ionicons name="document-text" size={20} color="#047857" />
              <Text style={styles.adminLabel}>Documents</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.adminCard} onPress={() => navigation.navigate('ServiceTypes')}>
              <Ionicons name="apps" size={20} color="#047857" />
              <Text style={styles.adminLabel}>Services</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.adminCard} onPress={() => navigation.navigate('SupportTicketsManagement')}>
              <Ionicons name="chatbubbles" size={20} color="#047857" />
              <Text style={styles.adminLabel}>Tickets</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Villes demandées (non disponibles) */}
        {citySearches.length > 0 && (
          <View style={styles.citySearchSection}>
            <View style={styles.citySearchHeader}>
              <View style={styles.citySearchTitleRow}>
                <Ionicons name="location-outline" size={20} color="#dc2626" />
                <Text style={styles.sectionTitle}>Villes demandées</Text>
              </View>
              <Text style={styles.citySearchSubtitle}>
                Localités recherchées par les utilisateurs mais non desservies
              </Text>
            </View>

            {citySearches.slice(0, 5).map((citySearch, index) => (
              <View key={index} style={styles.citySearchItem}>
                <View style={styles.citySearchRank}>
                  <Text style={styles.citySearchRankText}>{index + 1}</Text>
                </View>
                <View style={styles.citySearchInfo}>
                  <Text style={styles.citySearchName}>{citySearch.search_term}</Text>
                  <Text style={styles.citySearchDate}>
                    Dernière recherche: {new Date(citySearch.last_searched_at).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
                <View style={styles.citySearchCount}>
                  <Text style={styles.citySearchCountValue}>{citySearch.search_count}</Text>
                  <Text style={styles.citySearchCountLabel}>recherche{citySearch.search_count > 1 ? 's' : ''}</Text>
                </View>
              </View>
            ))}

            {citySearches.length > 5 && (
              <TouchableOpacity
                style={styles.citySearchMoreButton}
                onPress={() => toast.info('Voir toutes les villes demandées - Fonctionnalité à venir')}
              >
                <Text style={styles.citySearchMoreText}>
                  Voir les {citySearches.length - 5} autres villes
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#047857" />
              </TouchableOpacity>
            )}

            <View style={styles.citySearchTip}>
              <Ionicons name="bulb-outline" size={16} color="#d97706" />
              <Text style={styles.citySearchTipText}>
                Ajoutez ces villes dans "Administration {'>'} Villes" pour étendre votre couverture
              </Text>
            </View>
          </View>
        )}
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
  updateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  updateText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  alertsSection: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1.5,
  },
  alertCardUrgent: {
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  alertCardWarning: {
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
  },
  alertIconContainer: {
    marginRight: 10,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  alertMessage: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
    lineHeight: 16,
  },
  alertBadge: {
    backgroundColor: '#dc2626',
  },
  alertBadgeUrgent: {
    backgroundColor: '#dc2626',
  },
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
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
    marginBottom: 8,
  },
  statCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 1,
    letterSpacing: 0.3,
  },
  statLabel: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '700',
    marginBottom: 1,
  },
  statSubLabel: {
    fontSize: 9,
    color: '#6b7280',
    fontWeight: '600',
  },
  actionsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  actionCard: {
    width: '33.33%',
    paddingHorizontal: 6,
    marginBottom: 12,
    alignItems: 'center',
  },
  actionIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  actionSubLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
    textAlign: 'center',
  },
  adminSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  adminGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  adminCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  adminLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 0.2,
  },
  // Styles pour la section villes demandées
  citySearchSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  citySearchHeader: {
    marginBottom: 16,
  },
  citySearchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  citySearchSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginLeft: 28,
  },
  citySearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1.5,
    borderColor: '#fecaca',
  },
  citySearchRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  citySearchRankText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#dc2626',
  },
  citySearchInfo: {
    flex: 1,
  },
  citySearchName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  citySearchDate: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  citySearchCount: {
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  citySearchCountValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#dc2626',
  },
  citySearchCountLabel: {
    fontSize: 9,
    color: '#991b1b',
    fontWeight: '600',
  },
  citySearchMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  citySearchMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
  },
  citySearchTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  citySearchTipText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    fontWeight: '500',
    lineHeight: 18,
  },
  // Styles pour l'alerte paiements Wave
  paymentAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1d4ed8',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    elevation: 4,
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  paymentAlertIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  paymentAlertContent: {
    flex: 1,
  },
  paymentAlertTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 2,
  },
  paymentAlertMessage: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
  paymentAlertBadge: {
    backgroundColor: '#fbbf24',
    marginRight: 8,
  },
  actionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  // Bouton configuration ville
  citySetupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
    elevation: 3,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 2,
    borderColor: '#d1fae5',
  },
  citySetupIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  citySetupContent: {
    flex: 1,
  },
  citySetupTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#047857',
    marginBottom: 2,
  },
  citySetupSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
});
