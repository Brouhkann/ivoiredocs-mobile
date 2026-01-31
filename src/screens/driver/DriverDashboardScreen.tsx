import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, TextInput as RNTextInput } from 'react-native';
import { Text, Badge } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../config/supabase';
import { toast } from '../../stores/toastStore';
import { updateRequestStatus } from '../../services/requestService';
import { NotificationService } from '../../services/notifications';
import AppHeader from '../../components/AppHeader';
import type { Request } from '../../types';

function isAbidjanCommune(ville: string): boolean {
  if (!ville || typeof ville !== 'string') return false;
  const communesAbidjan = [
    "abidjan", "cocody", "plateau", "adjame", "abobo", "yopougon",
    "koumassi", "port-bouet", "marcory", "treichville", "attécoubé",
    "anyama", "bingerville", "songon"
  ];
  return communesAbidjan.includes(ville.toLowerCase().trim());
}

type TabType = 'pickup' | 'in_transit' | 'delivered';

export default function DriverDashboardScreen() {
  const { profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('pickup');
  const [requests, setRequests] = useState<Request[]>([]);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deliveryCodeInput, setDeliveryCodeInput] = useState<Record<string, string>>({});
  const [shippingCodeInput, setShippingCodeInput] = useState<Record<string, string>>({});
  const [stats, setStats] = useState({ today: 0, total: 0, rating: 5.0 });

  const loadDriverInfo = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      if (error) throw error;
      setDriverInfo(data);
      return data;
    } catch (error) {
      console.error('Erreur chargement info livreur:', error);
      return null;
    }
  }, [profile?.id]);

  const loadRequests = useCallback(async (driver?: any) => {
    const d = driver || driverInfo;
    if (!d) return;

    try {
      if (activeTab === 'pickup') {
        // Demandes expediees dans la zone du livreur, pas encore recuperees
        let query = supabase
          .from('requests')
          .select('*')
          .eq('status', 'shipped')
          .is('driver_id', null);

        if (d.zone_id) {
          query = query.eq('delivery_zone_id', d.zone_id);
        }

        const { data, error } = await query.order('shipped_at', { ascending: true });
        if (error) throw error;
        setRequests(data || []);
      } else if (activeTab === 'in_transit') {
        const { data, error } = await supabase
          .from('requests')
          .select('*')
          .eq('driver_id', d.id)
          .eq('status', 'in_transit')
          .order('in_transit_at', { ascending: false });

        if (error) throw error;
        setRequests(data || []);
      } else {
        const { data, error } = await supabase
          .from('requests')
          .select('*')
          .eq('driver_id', d.id)
          .in('status', ['delivered', 'completed'])
          .order('delivered_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setRequests(data || []);
      }
    } catch (error) {
      console.error('Erreur chargement demandes:', error);
    }
  }, [driverInfo, activeTab]);

  const loadStats = useCallback(async (driver?: any) => {
    const d = driver || driverInfo;
    if (!d) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('requests')
        .select('delivered_at')
        .eq('driver_id', d.id)
        .in('status', ['delivered', 'completed']);

      const total = data?.length || 0;
      const todayCount = data?.filter(r => r.delivered_at?.startsWith(today)).length || 0;

      setStats({ today: todayCount, total, rating: d.rating || 5.0 });
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  }, [driverInfo]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const driver = await loadDriverInfo();
      if (driver) {
        await Promise.all([loadRequests(driver), loadStats(driver)]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadDriverInfo]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (driverInfo) {
      loadRequests();
    }
  }, [activeTab]);

  const handlePickup = async (requestId: string) => {
    Alert.alert(
      'Recuperer le colis',
      'Confirmez-vous la recuperation de ce colis ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              await updateRequestStatus(requestId, 'in_transit', {
                driver_id: driverInfo.id,
              });

              // Notifier le client
              try {
                await NotificationService.notifyDeliveryPickedUp(requestId);
              } catch (e) {
                console.warn('Erreur notification pickup:', e);
              }

              toast.success('Colis recupere ! En route pour la livraison.');
              loadData(true);
            } catch (error) {
              console.error('Erreur recuperation:', error);
              toast.error('Erreur lors de la recuperation');
            }
          },
        },
      ]
    );
  };

  const handleDeliveryConfirm = async (requestId: string) => {
    const code = deliveryCodeInput[requestId];
    if (!code || code.length !== 4) {
      toast.error('Veuillez saisir le code a 4 chiffres');
      return;
    }

    try {
      // Verifier le code
      const { data: request, error } = await supabase
        .from('requests')
        .select('delivery_code')
        .eq('id', requestId)
        .single();

      if (error) throw error;

      if (request.delivery_code !== code) {
        toast.error('Code incorrect. Verifiez le code aupres du client.');
        return;
      }

      await updateRequestStatus(requestId, 'delivered');

      // Incrementer le compteur du livreur
      await supabase
        .from('drivers')
        .update({ total_deliveries: (driverInfo.total_deliveries || 0) + 1 })
        .eq('id', driverInfo.id);

      // Notifier le client
      try {
        await NotificationService.notifyExpressDeliveryCompleted(requestId);
      } catch (e) {
        console.warn('Erreur notification livraison:', e);
      }

      toast.success('Livraison confirmee avec succes !');
      setDeliveryCodeInput(prev => ({ ...prev, [requestId]: '' }));
      loadData(true);
    } catch (error) {
      console.error('Erreur confirmation livraison:', error);
      toast.error('Erreur lors de la confirmation');
    }
  };

  const handleSaveShippingCode = async (requestId: string) => {
    const code = shippingCodeInput[requestId];
    if (!code?.trim()) {
      toast.error('Veuillez saisir le code de retrait');
      return;
    }

    try {
      const { error } = await supabase
        .from('requests')
        .update({ shipping_code: code.trim() })
        .eq('id', requestId);

      if (error) throw error;
      toast.success('Code de retrait enregistre');
      setShippingCodeInput(prev => ({ ...prev, [requestId]: '' }));
      loadData(true);
    } catch (error) {
      console.error('Erreur sauvegarde code:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'shipped': return 'A recuperer';
      case 'in_transit': return 'En cours';
      case 'delivered': return 'Livre';
      case 'completed': return 'Termine';
      default: return status;
    }
  };

  const renderRequestCard = (request: Request) => {
    const formData = request.form_data || {};
    const deliveryData = formData.delivery_data || formData;
    const sectorName = deliveryData.delivery_sector_name || deliveryData.ville_destination || 'Non specifie';
    const commune = deliveryData.delivery_commune || deliveryData.ville_destination || '';

    return (
      <View key={request.id} style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.requestIdContainer}>
            <Text style={styles.requestId}>#{request.id.slice(-6).toUpperCase()}</Text>
            <Badge style={[
              styles.statusBadge,
              request.status === 'shipped' && { backgroundColor: '#f59e0b' },
              request.status === 'in_transit' && { backgroundColor: '#3b82f6' },
              request.status === 'delivered' && { backgroundColor: '#10b981' },
              request.status === 'completed' && { backgroundColor: '#6b7280' },
            ]}>
              {getStatusLabel(request.status)}
            </Badge>
          </View>
          <Text style={styles.requestDate}>
            {new Date(request.created_at).toLocaleDateString('fr-FR')}
          </Text>
        </View>

        <View style={styles.requestInfo}>
          <View style={styles.infoRow}>
            <Ionicons name="document-text" size={16} color="#6b7280" />
            <Text style={styles.infoText}>{request.document_type}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location" size={16} color="#6b7280" />
            <Text style={styles.infoText}>{sectorName}, {commune}</Text>
          </View>
          {request.delivery_price && (
            <View style={styles.infoRow}>
              <Ionicons name="cash" size={16} color="#6b7280" />
              <Text style={styles.infoText}>{request.delivery_price?.toLocaleString()} FCFA</Text>
            </View>
          )}
        </View>

        {/* Code de retrait (si le colis a ete expedie par transport) */}
        {request.shipping_code && (
          <View style={styles.shippingCodeDisplay}>
            <Ionicons name="key" size={16} color="#0284c7" />
            <Text style={styles.shippingCodeLabel}>Code de retrait :</Text>
            <Text style={styles.shippingCodeValue}>{request.shipping_code}</Text>
          </View>
        )}

        {/* Bouton Recuperer */}
        {activeTab === 'pickup' && (
          <TouchableOpacity
            style={styles.pickupButton}
            onPress={() => handlePickup(request.id)}
          >
            <Ionicons name="hand-left" size={18} color="#fff" />
            <Text style={styles.pickupButtonText}>Recuperer</Text>
          </TouchableOpacity>
        )}

        {/* Saisie code d'expedition (quand le livreur expedie lui-meme) */}
        {activeTab === 'in_transit' && !request.shipping_code && deliveryData.moyen_recuperation === 'livraison_express' && deliveryData.ville_destination && !isAbidjanCommune(deliveryData.ville_destination || '') && (
          <View style={styles.deliveryConfirmSection}>
            <Text style={styles.deliveryConfirmLabel}>Code de retrait a la gare :</Text>
            <View style={styles.codeInputRow}>
              <RNTextInput
                style={[styles.codeInput, { letterSpacing: 2, fontSize: 16 }]}
                value={shippingCodeInput[request.id] || ''}
                onChangeText={(text) => setShippingCodeInput(prev => ({ ...prev, [request.id]: text }))}
                placeholder="Code retrait"
                placeholderTextColor="#9ca3af"
              />
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: '#0284c7' }]}
                onPress={() => handleSaveShippingCode(request.id)}
              >
                <Ionicons name="save" size={18} color="#fff" />
                <Text style={styles.confirmButtonText}>Sauver</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Saisie code pour confirmer livraison */}
        {activeTab === 'in_transit' && (
          <View style={styles.deliveryConfirmSection}>
            <Text style={styles.deliveryConfirmLabel}>Code de confirmation (4 chiffres) :</Text>
            <View style={styles.codeInputRow}>
              <RNTextInput
                style={styles.codeInput}
                value={deliveryCodeInput[request.id] || ''}
                onChangeText={(text) => {
                  const cleaned = text.replace(/\D/g, '').slice(0, 4);
                  setDeliveryCodeInput(prev => ({ ...prev, [request.id]: cleaned }));
                }}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="----"
                placeholderTextColor="#9ca3af"
              />
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  (!deliveryCodeInput[request.id] || deliveryCodeInput[request.id].length !== 4) && styles.confirmButtonDisabled,
                ]}
                onPress={() => handleDeliveryConfirm(request.id)}
                disabled={!deliveryCodeInput[request.id] || deliveryCodeInput[request.id].length !== 4}
              >
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.confirmButtonText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'pickup', label: 'A recuperer', icon: 'cube' },
    { key: 'in_transit', label: 'En cours', icon: 'bicycle' },
    { key: 'delivered', label: 'Livres', icon: 'checkmark-done' },
  ];

  return (
    <View style={styles.container}>
      <AppHeader
        userName={profile?.name?.split(' ')[0] || 'Livreur'}
        showLogo={true}
      />

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.today}</Text>
          <Text style={styles.statLabel}>Aujourd'hui</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.rating.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Note</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? '#2563eb' : '#6b7280'}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Liste des demandes */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            colors={['#2563eb']}
          />
        }
      >
        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Chargement...</Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name={activeTab === 'pickup' ? 'cube-outline' : activeTab === 'in_transit' ? 'bicycle-outline' : 'checkmark-done-outline'}
              size={48}
              color="#d1d5db"
            />
            <Text style={styles.emptyTitle}>
              {activeTab === 'pickup' ? 'Aucun colis a recuperer' :
               activeTab === 'in_transit' ? 'Aucune livraison en cours' :
               'Aucune livraison effectuee'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'pickup' ? 'Les nouveaux colis dans votre zone apparaitront ici' :
               activeTab === 'in_transit' ? 'Recuperez un colis pour commencer' :
               'Votre historique de livraisons sera affiche ici'}
            </Text>
          </View>
        ) : (
          requests.map(renderRequestCard)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statValue: { fontSize: 22, fontWeight: '900', color: '#2563eb' },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#6b7280', marginTop: 2 },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    gap: 6,
    elevation: 1,
  },
  tabActive: {
    backgroundColor: '#dbeafe',
    borderWidth: 1.5,
    borderColor: '#93c5fd',
  },
  tabText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#2563eb', fontWeight: '800' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  requestIdContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requestId: { fontSize: 14, fontWeight: '800', color: '#111827' },
  statusBadge: { fontSize: 10 },
  requestDate: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  requestInfo: { gap: 6, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  pickupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  pickupButtonText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  deliveryConfirmSection: { marginTop: 4 },
  deliveryConfirmLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 8 },
  codeInputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  codeInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 12,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  confirmButtonDisabled: { backgroundColor: '#9ca3af' },
  confirmButtonText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  shippingCodeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  shippingCodeLabel: { fontSize: 12, fontWeight: '600', color: '#0284c7' },
  shippingCodeValue: { fontSize: 14, fontWeight: '900', color: '#0c4a6e', letterSpacing: 2 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#374151' },
  emptyText: { fontSize: 13, color: '#6b7280', textAlign: 'center', paddingHorizontal: 40 },
});
