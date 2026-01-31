import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Text, TextInput, Switch } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { toast } from '../../stores/toastStore';
import type { Driver, DeliveryZone } from '../../types';

export default function DriversManagementScreen({ navigation }: any) {
  const [drivers, setDrivers] = useState<(Driver & { zone_name?: string })[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Formulaire ajout livreur
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchPhone, setSearchPhone] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [mobileMoneyContact, setMobileMoneyContact] = useState('');

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [driversRes, zonesRes] = await Promise.all([
        supabase.from('drivers').select('*').order('name'),
        supabase.from('delivery_zones').select('*').order('display_order'),
      ]);

      if (zonesRes.data) setZones(zonesRes.data);

      if (driversRes.data && zonesRes.data) {
        const zonesMap = new Map(zonesRes.data.map(z => [z.id, z.name]));
        setDrivers(driversRes.data.map(d => ({
          ...d,
          zone_name: d.zone_id ? zonesMap.get(d.zone_id) : undefined,
        })));
      }
    } catch (error) {
      console.error('Erreur chargement livreurs:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  const toggleDriverActive = async (driverId: string, isActive: boolean) => {
    try {
      await supabase.from('drivers').update({ is_active: !isActive }).eq('id', driverId);
      toast.success(`Livreur ${!isActive ? 'active' : 'desactive'}`);
      loadData(true);
    } catch (error) {
      toast.error('Erreur mise a jour');
    }
  };

  const searchUser = async () => {
    if (!searchPhone.trim()) {
      toast.error('Veuillez saisir un numero de telephone');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, phone, role')
        .ilike('phone', `%${searchPhone.trim()}%`)
        .limit(5);

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error('Aucun utilisateur trouve avec ce numero');
        setFoundUser(null);
        return;
      }

      // Si un seul resultat, le selectionner directement
      if (data.length === 1) {
        setFoundUser(data[0]);
      } else {
        // Afficher le premier resultat
        setFoundUser(data[0]);
        toast.info(`${data.length} utilisateurs trouves, le premier est affiche`);
      }
    } catch (error) {
      toast.error('Erreur recherche utilisateur');
    }
  };

  const handleAddDriver = async () => {
    if (!foundUser) {
      toast.error('Veuillez rechercher un utilisateur');
      return;
    }
    if (!selectedZoneId) {
      toast.error('Veuillez selectionner une zone');
      return;
    }

    try {
      // Verifier si l'utilisateur est deja livreur
      const { data: existing } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', foundUser.id)
        .maybeSingle();

      if (existing) {
        toast.error('Cet utilisateur est deja enregistre comme livreur');
        return;
      }

      // Creer le livreur
      const { error: driverError } = await supabase.from('drivers').insert({
        user_id: foundUser.id,
        name: foundUser.name,
        phone: foundUser.phone,
        zone_id: selectedZoneId,
        mobile_money_contact: mobileMoneyContact || foundUser.phone,
      });

      if (driverError) throw driverError;

      // Mettre a jour le role de l'utilisateur
      const { error: roleError } = await supabase
        .from('users')
        .update({ role: 'driver' })
        .eq('id', foundUser.id);

      if (roleError) {
        console.warn('Erreur mise a jour role:', roleError);
      }

      toast.success(`${foundUser.name} ajoute comme livreur`);
      setShowAddForm(false);
      setFoundUser(null);
      setSearchPhone('');
      setSelectedZoneId('');
      setMobileMoneyContact('');
      loadData(true);
    } catch (error: any) {
      toast.error(error.message || 'Erreur ajout livreur');
    }
  };

  const handleUpdateZone = async (driverId: string, zoneId: string) => {
    try {
      await supabase.from('drivers').update({ zone_id: zoneId }).eq('id', driverId);
      toast.success('Zone mise a jour');
      loadData(true);
    } catch (error) {
      toast.error('Erreur mise a jour zone');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Livreurs</Text>
        <TouchableOpacity
          style={styles.addHeaderButton}
          onPress={() => setShowAddForm(!showAddForm)}
        >
          <Ionicons name={showAddForm ? 'close' : 'add'} size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
      >
        {/* Formulaire ajout */}
        {showAddForm && (
          <View style={styles.addForm}>
            <Text style={styles.formTitle}>Ajouter un livreur</Text>

            <Text style={styles.fieldLabel}>Rechercher par telephone</Text>
            <View style={styles.searchRow}>
              <TextInput
                value={searchPhone}
                onChangeText={setSearchPhone}
                mode="outlined"
                placeholder="07 XX XX XX XX"
                keyboardType="phone-pad"
                style={[styles.input, { flex: 1 }]}
              />
              <TouchableOpacity style={styles.searchButton} onPress={searchUser}>
                <Ionicons name="search" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Utilisateur trouve */}
            {foundUser && (
              <View style={styles.foundUserCard}>
                <Ionicons name="person-circle" size={36} color="#047857" />
                <View style={styles.foundUserInfo}>
                  <Text style={styles.foundUserName}>{foundUser.name}</Text>
                  <Text style={styles.foundUserPhone}>{foundUser.phone}</Text>
                  <Text style={styles.foundUserRole}>Role actuel : {foundUser.role || 'user'}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              </View>
            )}

            {/* Selection zone */}
            {foundUser && (
              <>
                <Text style={styles.fieldLabel}>Zone a assigner *</Text>
                <View style={styles.zoneSelector}>
                  {zones.map((z) => (
                    <TouchableOpacity
                      key={z.id}
                      style={[styles.zoneOption, selectedZoneId === z.id && styles.zoneOptionActive]}
                      onPress={() => setSelectedZoneId(z.id)}
                    >
                      <Text style={[styles.zoneOptionText, selectedZoneId === z.id && styles.zoneOptionTextActive]}>
                        {z.name} ({z.code})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  label="Contact Mobile Money"
                  value={mobileMoneyContact}
                  onChangeText={setMobileMoneyContact}
                  mode="outlined"
                  placeholder="Numero pour les paiements"
                  keyboardType="phone-pad"
                  style={styles.input}
                />

                <TouchableOpacity style={styles.saveButton} onPress={handleAddDriver}>
                  <Ionicons name="person-add" size={18} color="#fff" />
                  <Text style={styles.saveButtonText}>Ajouter comme livreur</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{drivers.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{drivers.filter(d => d.is_active).length}</Text>
            <Text style={styles.statLabel}>Actifs</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{drivers.reduce((s, d) => s + d.total_deliveries, 0)}</Text>
            <Text style={styles.statLabel}>Livraisons</Text>
          </View>
        </View>

        {/* Liste des livreurs */}
        <Text style={styles.sectionTitle}>Livreurs ({drivers.length})</Text>
        {drivers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bicycle-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Aucun livreur</Text>
            <Text style={styles.emptyText}>Ajoutez un livreur avec le bouton +</Text>
          </View>
        ) : (
          drivers.map((driver) => (
            <View key={driver.id} style={styles.driverCard}>
              <View style={styles.driverHeader}>
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>{driver.name}</Text>
                  <Text style={styles.driverPhone}>{driver.phone}</Text>
                </View>
                <Switch
                  value={driver.is_active}
                  onValueChange={() => toggleDriverActive(driver.id, driver.is_active)}
                  color="#047857"
                />
              </View>

              <View style={styles.driverStats}>
                <View style={styles.driverStat}>
                  <Ionicons name="map" size={14} color="#6b7280" />
                  <Text style={styles.driverStatText}>{driver.zone_name || 'Non assignee'}</Text>
                </View>
                <View style={styles.driverStat}>
                  <Ionicons name="bicycle" size={14} color="#6b7280" />
                  <Text style={styles.driverStatText}>{driver.total_deliveries} livraisons</Text>
                </View>
                <View style={styles.driverStat}>
                  <Ionicons name="star" size={14} color="#f59e0b" />
                  <Text style={styles.driverStatText}>{driver.rating?.toFixed(1) || '5.0'}</Text>
                </View>
              </View>

              {/* Changer zone */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.zoneChangeRow}>
                {zones.map((z) => (
                  <TouchableOpacity
                    key={z.id}
                    style={[
                      styles.zoneChip,
                      driver.zone_id === z.id && styles.zoneChipActive,
                    ]}
                    onPress={() => handleUpdateZone(driver.id, z.id)}
                  >
                    <Text style={[
                      styles.zoneChipText,
                      driver.zone_id === z.id && styles.zoneChipTextActive,
                    ]}>
                      {z.code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#047857',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  backButton: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#fff' },
  addHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: { padding: 20, paddingBottom: 40 },
  addForm: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 2,
    borderColor: '#d1fae5',
  },
  formTitle: { fontSize: 16, fontWeight: '800', color: '#047857', marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 8 },
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 12 },
  input: { backgroundColor: '#fff', marginBottom: 10 },
  searchButton: {
    backgroundColor: '#047857',
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  foundUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  foundUserInfo: { flex: 1 },
  foundUserName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  foundUserPhone: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  foundUserRole: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  zoneSelector: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  zoneOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  zoneOptionActive: { backgroundColor: '#d1fae5', borderColor: '#047857' },
  zoneOptionText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  zoneOptionTextActive: { color: '#047857', fontWeight: '800' },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#047857',
    borderRadius: 10,
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
  },
  saveButtonText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    elevation: 2,
  },
  statValue: { fontSize: 22, fontWeight: '900', color: '#047857' },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#6b7280', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#374151' },
  emptyText: { fontSize: 13, color: '#6b7280' },
  driverCard: {
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
  driverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  driverPhone: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  driverStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  driverStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  driverStatText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  zoneChangeRow: { marginTop: 4 },
  zoneChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  zoneChipActive: { backgroundColor: '#d1fae5', borderColor: '#047857' },
  zoneChipText: { fontSize: 11, fontWeight: '600', color: '#6b7280' },
  zoneChipTextActive: { color: '#047857', fontWeight: '800' },
});
