import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image, Modal } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import Loading from '../../components/ui/Loading';

interface EarningItem {
  id: string;
  document_type: string;
  city: string;
  delegate_earnings: number;
  delegate_payment_status: 'pending' | 'paid';
  delegate_payment_proof_url?: string;
  delegate_paid_at?: string;
  assigned_at: string;
  status: string;
}

export default function DelegateEarningsScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [earnings, setEarnings] = useState<EarningItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [selectedProof, setSelectedProof] = useState<string | null>(null);
  const [delegateId, setDelegateId] = useState<string | null>(null);

  const fetchEarnings = async () => {
    try {
      // D'abord récupérer l'ID du délégué
      const { data: delegate } = await supabase
        .from('delegates')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!delegate) {
        setLoading(false);
        return;
      }

      setDelegateId(delegate.id);

      // Récupérer les demandes avec dotations
      let query = supabase
        .from('requests')
        .select('*')
        .eq('delegate_id', delegate.id)
        .in('status', ['assigned', 'in_progress', 'ready', 'shipped', 'delivered', 'completed']);

      if (filter === 'pending') {
        query = query.or('delegate_payment_status.is.null,delegate_payment_status.eq.pending');
      } else if (filter === 'paid') {
        query = query.eq('delegate_payment_status', 'paid');
      }

      const { data, error } = await query.order('assigned_at', { ascending: false });

      if (error) throw error;

      const formattedEarnings: EarningItem[] = (data || []).map((item: any) => ({
        id: item.id,
        document_type: item.document_type,
        city: item.city,
        delegate_earnings: item.delegate_earnings || 0,
        delegate_payment_status: item.delegate_payment_status || 'pending',
        delegate_payment_proof_url: item.delegate_payment_proof_url,
        delegate_paid_at: item.delegate_paid_at,
        assigned_at: item.assigned_at,
        status: item.status,
      }));

      setEarnings(formattedEarnings);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchEarnings();
    }, [filter, user?.id])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchEarnings();
  };

  // Voir la preuve de paiement
  const handleViewProof = async (proofPath: string) => {
    try {
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(proofPath, 3600);

      if (data?.signedUrl) {
        setSelectedProof(data.signedUrl);
      } else {
        setSelectedProof(proofPath);
      }
    } catch (error) {
      setSelectedProof(proofPath);
    }
  };

  // Calculs
  const totalEarnings = earnings.reduce((sum, e) => sum + e.delegate_earnings, 0);
  const paidEarnings = earnings
    .filter(e => e.delegate_payment_status === 'paid')
    .reduce((sum, e) => sum + e.delegate_earnings, 0);
  const pendingEarnings = earnings
    .filter(e => e.delegate_payment_status !== 'paid')
    .reduce((sum, e) => sum + e.delegate_earnings, 0);

  if (loading) {
    return <Loading message="Chargement..." />;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Dotations</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Résumé */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryMain}>
          <Text style={styles.summaryLabel}>Total des dotations</Text>
          <Text style={styles.summaryValue}>{totalEarnings.toLocaleString()} FCFA</Text>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.summaryItemLabel}>Reçues</Text>
            <Text style={styles.summaryItemValue}>{paidEarnings.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={styles.summaryItemLabel}>En attente</Text>
            <Text style={styles.summaryItemValue}>{pendingEarnings.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      {/* Filtres */}
      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>Toutes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'paid' && styles.filterBtnActive]}
          onPress={() => setFilter('paid')}
        >
          <Text style={[styles.filterText, filter === 'paid' && styles.filterTextActive]}>Reçues</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'pending' && styles.filterBtnActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>En attente</Text>
        </TouchableOpacity>
      </View>

      {/* Liste */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#047857']} />
        }
      >
        {earnings.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>Aucune dotation</Text>
          </View>
        ) : (
          earnings.map((item) => (
            <View
              key={item.id}
              style={[
                styles.earningCard,
                item.delegate_payment_status === 'paid' && styles.earningCardPaid,
              ]}
            >
              <View style={styles.earningHeader}>
                <View>
                  <Text style={styles.earningDoc}>{item.document_type}</Text>
                  <Text style={styles.earningCity}>{item.city}</Text>
                </View>
                <View style={styles.earningAmountContainer}>
                  <Text style={styles.earningAmount}>{item.delegate_earnings.toLocaleString()}</Text>
                  <Text style={styles.earningCurrency}>FCFA</Text>
                </View>
              </View>

              <View style={styles.earningFooter}>
                <Text style={styles.earningDate}>
                  Mission du {new Date(item.assigned_at).toLocaleDateString('fr-FR')}
                </Text>

                {item.delegate_payment_status === 'paid' ? (
                  <TouchableOpacity
                    style={styles.paidBadge}
                    onPress={() => item.delegate_payment_proof_url && handleViewProof(item.delegate_payment_proof_url)}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                    <Text style={styles.paidText}>Reçue</Text>
                    {item.delegate_payment_proof_url && (
                      <Ionicons name="eye" size={14} color="#10b981" />
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.pendingBadge}>
                    <Ionicons name="time" size={16} color="#f59e0b" />
                    <Text style={styles.pendingText}>En attente</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal preuve */}
      <Modal visible={!!selectedProof} transparent animationType="fade">
        <View style={styles.proofModal}>
          <View style={styles.proofModalContent}>
            <View style={styles.proofModalHeader}>
              <Text style={styles.proofModalTitle}>Preuve de paiement</Text>
              <TouchableOpacity onPress={() => setSelectedProof(null)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {selectedProof && (
              <Image
                source={{ uri: selectedProof }}
                style={styles.proofImage}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#047857',
    paddingTop: 50,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: '#047857',
    marginHorizontal: 16,
    marginTop: -10,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
  },
  summaryMain: {
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  summaryItemLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  summaryItemValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterBtnActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  filterText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 14,
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#9ca3af',
    marginTop: 12,
    fontSize: 16,
  },
  earningCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  earningCardPaid: {
    borderLeftColor: '#10b981',
  },
  earningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  earningDoc: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  earningCity: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  earningAmountContainer: {
    alignItems: 'flex-end',
  },
  earningAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#047857',
  },
  earningCurrency: {
    fontSize: 11,
    color: '#6b7280',
  },
  earningFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  earningDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  paidText: {
    color: '#047857',
    fontWeight: '600',
    fontSize: 12,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  pendingText: {
    color: '#f59e0b',
    fontWeight: '600',
    fontSize: 12,
  },
  // Modal
  proofModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  proofModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  proofModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  proofModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  proofImage: {
    width: '100%',
    height: 400,
    backgroundColor: '#f3f4f6',
  },
});
