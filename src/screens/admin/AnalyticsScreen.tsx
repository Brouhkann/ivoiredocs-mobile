import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { toast } from '../../stores/toastStore';
import AppHeader from '../../components/AppHeader';

const { width } = Dimensions.get('window');

interface AnalyticsData {
  totalRevenue: number;
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  totalRequests: number;
  completedRequests: number;
  cancelledRequests: number;
  averageAmount: number;
  averageProcessingTime: number;
  successRate: number;
  topCities: Array<{ city: string; count: number; revenue: number }>;
  topDocuments: Array<{ type: string; count: number }>;
  revenueByDay: Array<{ date: string; amount: number }>;
}

export default function AnalyticsScreen({ navigation }: any) {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalRevenue: 0,
    revenueToday: 0,
    revenueThisWeek: 0,
    revenueThisMonth: 0,
    totalRequests: 0,
    completedRequests: 0,
    cancelledRequests: 0,
    averageAmount: 0,
    averageProcessingTime: 0,
    successRate: 0,
    topCities: [],
    topDocuments: [],
    revenueByDay: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAnalytics = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Load all requests
      const { data: requests, error } = await supabase
        .from('requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      // Calculate revenue stats
      const completedRequests = requests?.filter(r => r.status === 'completed') || [];
      const totalRevenue = completedRequests.reduce((sum, r) => sum + (r.total_amount || 0), 0);
      const revenueToday = completedRequests
        .filter(r => r.completed_at?.startsWith(todayStr))
        .reduce((sum, r) => sum + (r.total_amount || 0), 0);
      const revenueThisWeek = completedRequests
        .filter(r => r.completed_at && new Date(r.completed_at) >= weekAgo)
        .reduce((sum, r) => sum + (r.total_amount || 0), 0);
      const revenueThisMonth = completedRequests
        .filter(r => r.completed_at && new Date(r.completed_at) >= monthAgo)
        .reduce((sum, r) => sum + (r.total_amount || 0), 0);

      // Calculate processing stats
      const requestsWithProcessing = completedRequests.filter(
        r => r.assigned_at && r.completed_at
      );
      const averageProcessingTime =
        requestsWithProcessing.length > 0
          ? requestsWithProcessing.reduce((sum, r) => {
              const assigned = new Date(r.assigned_at!).getTime();
              const completed = new Date(r.completed_at!).getTime();
              return sum + (completed - assigned) / (1000 * 60 * 60); // en heures
            }, 0) / requestsWithProcessing.length
          : 0;

      const totalRequests = requests?.length || 0;
      const cancelledRequests = requests?.filter(r => r.status === 'cancelled').length || 0;
      const successRate =
        totalRequests > 0 ? (completedRequests.length / totalRequests) * 100 : 0;
      const averageAmount =
        completedRequests.length > 0 ? totalRevenue / completedRequests.length : 0;

      // Top cities
      const cityStats: Record<string, { count: number; revenue: number }> = {};
      completedRequests.forEach(r => {
        if (!cityStats[r.city]) {
          cityStats[r.city] = { count: 0, revenue: 0 };
        }
        cityStats[r.city].count++;
        cityStats[r.city].revenue += r.total_amount || 0;
      });
      const topCities = Object.entries(cityStats)
        .map(([city, stats]) => ({ city, ...stats }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Top documents
      const docStats: Record<string, number> = {};
      requests?.forEach(r => {
        docStats[r.document_type] = (docStats[r.document_type] || 0) + 1;
      });
      const topDocuments = Object.entries(docStats)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Revenue by day (last 7 days)
      const revenueByDay: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        revenueByDay[dateStr] = 0;
      }
      completedRequests.forEach(r => {
        if (r.completed_at) {
          const dateStr = r.completed_at.split('T')[0];
          if (revenueByDay[dateStr] !== undefined) {
            revenueByDay[dateStr] += r.total_amount || 0;
          }
        }
      });
      const revenueByDayArray = Object.entries(revenueByDay).map(([date, amount]) => ({
        date,
        amount,
      }));

      setAnalytics({
        totalRevenue,
        revenueToday,
        revenueThisWeek,
        revenueThisMonth,
        totalRequests,
        completedRequests: completedRequests.length,
        cancelledRequests,
        averageAmount,
        averageProcessingTime: Math.round(averageProcessingTime),
        successRate: Math.round(successRate),
        topCities,
        topDocuments,
        revenueByDay: revenueByDayArray,
      });
    } catch (error: any) {
      console.error('Erreur chargement analytics:', error);
      toast.error('Erreur lors du chargement des analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const handleRefresh = useCallback(() => {
    loadAnalytics(true);
  }, [loadAnalytics]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  const maxRevenue = Math.max(...analytics.revenueByDay.map(d => d.amount), 1);

  return (
    <View style={styles.container}>
      <AppHeader
        title="Analytics"
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
        {/* Revenue Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revenus</Text>
          <View style={styles.revenueGrid}>
            <View style={[styles.revenueCard, { backgroundColor: '#e0f2fe' }]}>
              <Ionicons name="cash" size={28} color="#0284c7" />
              <Text style={styles.revenueValue}>
                {(analytics.totalRevenue / 1000).toFixed(0)}K
              </Text>
              <Text style={styles.revenueLabel}>Total</Text>
            </View>
            <View style={[styles.revenueCard, { backgroundColor: '#fce7f3' }]}>
              <Ionicons name="trending-up" size={28} color="#db2777" />
              <Text style={styles.revenueValue}>
                {(analytics.revenueToday / 1000).toFixed(0)}K
              </Text>
              <Text style={styles.revenueLabel}>Aujourd'hui</Text>
            </View>
            <View style={[styles.revenueCard, { backgroundColor: '#e9d5ff' }]}>
              <Ionicons name="calendar" size={28} color="#9333ea" />
              <Text style={styles.revenueValue}>
                {(analytics.revenueThisWeek / 1000).toFixed(0)}K
              </Text>
              <Text style={styles.revenueLabel}>Cette semaine</Text>
            </View>
            <View style={[styles.revenueCard, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="stats-chart" size={28} color="#2563eb" />
              <Text style={styles.revenueValue}>
                {(analytics.revenueThisMonth / 1000).toFixed(0)}K
              </Text>
              <Text style={styles.revenueLabel}>Ce mois</Text>
            </View>
          </View>
        </View>

        {/* Revenue Chart (Last 7 Days) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revenus des 7 derniers jours</Text>
          <View style={styles.chartContainer}>
            {analytics.revenueByDay.map((item, index) => {
              const height = (item.amount / maxRevenue) * 120;
              const date = new Date(item.date);
              const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' });

              return (
                <View key={item.date} style={styles.chartBar}>
                  <View style={styles.chartBarContainer}>
                    <View
                      style={[
                        styles.chartBarFill,
                        {
                          height: Math.max(height, 4),
                          backgroundColor: '#047857',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.chartBarLabel}>{dayName}</Text>
                  <Text style={styles.chartBarValue}>
                    {item.amount > 0 ? `${(item.amount / 1000).toFixed(0)}K` : '0'}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Performance Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="document-text" size={24} color="#6b7280" />
              <Text style={styles.statValue}>{analytics.totalRequests}</Text>
              <Text style={styles.statLabel}>Total demandes</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
              <Text style={styles.statValue}>{analytics.completedRequests}</Text>
              <Text style={styles.statLabel}>Terminées</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="close-circle" size={24} color="#dc2626" />
              <Text style={styles.statValue}>{analytics.cancelledRequests}</Text>
              <Text style={styles.statLabel}>Annulées</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="trending-up" size={24} color="#047857" />
              <Text style={styles.statValue}>{analytics.successRate}%</Text>
              <Text style={styles.statLabel}>Taux de succès</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="cash-outline" size={24} color="#2563eb" />
              <Text style={styles.statValue}>
                {(analytics.averageAmount / 1000).toFixed(1)}K
              </Text>
              <Text style={styles.statLabel}>Montant moyen</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="time-outline" size={24} color="#9333ea" />
              <Text style={styles.statValue}>{analytics.averageProcessingTime}h</Text>
              <Text style={styles.statLabel}>Temps moyen</Text>
            </View>
          </View>
        </View>

        {/* Top Cities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top villes par revenus</Text>
          {analytics.topCities.map((city, index) => (
            <View key={city.city} style={styles.topItem}>
              <View style={styles.topItemRank}>
                <Text style={styles.topItemRankText}>{index + 1}</Text>
              </View>
              <View style={styles.topItemInfo}>
                <Text style={styles.topItemName}>{city.city}</Text>
                <Text style={styles.topItemSubtext}>{city.count} demandes</Text>
              </View>
              <Text style={styles.topItemValue}>
                {(city.revenue / 1000).toFixed(0)}K FCFA
              </Text>
            </View>
          ))}
          {analytics.topCities.length === 0 && (
            <Text style={styles.emptyText}>Aucune donnée disponible</Text>
          )}
        </View>

        {/* Top Documents */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documents les plus demandés</Text>
          {analytics.topDocuments.map((doc, index) => (
            <View key={doc.type} style={styles.topItem}>
              <View style={styles.topItemRank}>
                <Text style={styles.topItemRankText}>{index + 1}</Text>
              </View>
              <View style={styles.topItemInfo}>
                <Text style={styles.topItemName}>{doc.type}</Text>
              </View>
              <Text style={styles.topItemValue}>{doc.count} demandes</Text>
            </View>
          ))}
          {analytics.topDocuments.length === 0 && (
            <Text style={styles.emptyText}>Aucune donnée disponible</Text>
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
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  revenueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  revenueCard: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  revenueValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
    marginTop: 12,
    marginBottom: 4,
  },
  revenueLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 160,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    paddingTop: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  chartBarContainer: {
    height: 120,
    justifyContent: 'flex-end',
    width: '100%',
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 4,
  },
  chartBarLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
    marginTop: 6,
  },
  chartBarValue: {
    fontSize: 9,
    color: '#9ca3af',
    marginTop: 2,
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
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
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
  },
  topItem: {
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
  topItemRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  topItemRankText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
  },
  topItemInfo: {
    flex: 1,
  },
  topItemName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  topItemSubtext: {
    fontSize: 12,
    color: '#6b7280',
  },
  topItemValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#047857',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
