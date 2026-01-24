import React, { useMemo } from 'react';
import { View, StyleSheet, SectionList, RefreshControl, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Text, FAB, Avatar } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { useRequests } from '../../hooks/useRequests';
import Loading from '../../components/ui/Loading';
import RequestCard from '../../components/request/RequestCard';
import StatsCard from '../../components/ui/StatsCard';
import AppHeader from '../../components/AppHeader';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function DashboardScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const { requests, loading, refreshing, refresh } = useRequests();

  // Calculer les statistiques
  const stats = useMemo(() => {
    const total = requests.length;
    const inProgress = requests.filter(r =>
      ['new', 'assigned', 'in_progress'].includes(r.status)
    ).length;

    return { total, inProgress };
  }, [requests]);

  // Grouper les demandes par mois
  const groupedRequests = useMemo(() => {
    // Trier par date décroissante (plus récent en premier)
    const sortedRequests = [...requests].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Grouper par mois/année
    const groups = sortedRequests.reduce((acc, request) => {
      const date = new Date(request.created_at);
      const monthYear = format(date, 'MMMM yyyy', { locale: fr });

      if (!acc[monthYear]) {
        acc[monthYear] = [];
      }
      acc[monthYear].push(request);

      return acc;
    }, {} as Record<string, typeof requests>);

    // Convertir en format SectionList
    return Object.entries(groups).map(([title, data]) => ({
      title,
      data,
    }));
  }, [requests]);

  if (loading) {
    return <Loading message="Chargement de vos demandes..." />;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <AppHeader
        userName={profile?.name?.split(' ')[0] || 'Utilisateur'}
        showLogo={true}
      />

      <SectionList
        sections={groupedRequests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RequestCard
            request={item}
            onPress={() => navigation.navigate('RequestDetail', { requestId: item.id })}
          />
        )}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.monthHeader}>
            <Text style={styles.monthTitle}>{title}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <>
            {/* Section Statistiques */}
            <View style={styles.statsSection}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Vue d'ensemble
              </Text>
              <View style={styles.statsGrid}>
                <StatsCard
                  icon="document-text"
                  label="Total"
                  value={stats.total}
                  color="#047857"
                />
                <StatsCard
                  icon="time"
                  label="En cours"
                  value={stats.inProgress}
                  color="#d4af37"
                />
              </View>

              {/* Bouton Support WhatsApp */}
              <TouchableOpacity
                style={styles.supportButton}
                onPress={() => {
                  const message = encodeURIComponent('Bonjour, j\'ai besoin d\'aide concernant mon compte Ivoiredocs.');
                  Linking.openURL(`https://wa.me/2250545703076?text=${message}`);
                }}
              >
                <View style={styles.supportButtonContent}>
                  <View style={[styles.supportIconContainer, { backgroundColor: '#dcfce7' }]}>
                    <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                  </View>
                  <View style={styles.supportTextContainer}>
                    <Text style={styles.supportButtonTitle}>Besoin d'aide ?</Text>
                    <Text style={styles.supportButtonSubtitle}>Discutez avec nous sur WhatsApp</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#25D366" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Titre de la liste */}
            <View style={styles.listHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Mes demandes récentes
              </Text>
              <Text variant="bodySmall" style={styles.listCount}>
                {requests.length} {requests.length > 1 ? 'demandes' : 'demande'}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="document-text-outline" size={64} color="#d1d5db" />
            </View>
            <Text variant="titleMedium" style={styles.emptyTitle}>
              Aucune demande
            </Text>
            <Text variant="bodyMedium" style={styles.emptyText}>
              Commencez par créer votre première{'\n'}demande de document administratif
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={['#047857']}
            tintColor="#047857"
          />
        }
      />

      {/* Bouton flottant amélioré */}
      <FAB
        icon="plus"
        label="Nouvelle demande"
        style={styles.fab}
        color="#ffffff"
        onPress={() => navigation.navigate('DocumentSelection')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  statsSection: {
    padding: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    color: '#111827',
    fontWeight: '600',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  listCount: {
    color: '#6b7280',
  },
  listContent: {
    paddingBottom: 100,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
    marginTop: 40,
  },
  emptyIcon: {
    marginBottom: 24,
    opacity: 0.5,
  },
  emptyTitle: {
    color: '#374151',
    marginBottom: 8,
    fontWeight: '600',
  },
  emptyText: {
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
  },
  monthHeader: {
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#d4af37',
  },
  monthTitle: {
    color: '#047857',
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  supportButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  supportButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  supportIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  supportTextContainer: {
    flex: 1,
  },
  supportButtonTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  supportButtonSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: '#047857',
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
});
