import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Text, TextInput, Switch } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { toast } from '../../stores/toastStore';
import { calculateExpressPriceFromCoords, getDistanceKm } from '../../services/deliveryService';
import type { DeliveryZone, DeliverySector, DeliveryPricingConfig } from '../../types';

export default function ZonesManagementScreen({ navigation }: any) {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [sectors, setSectors] = useState<DeliverySector[]>([]);
  const [pricingConfig, setPricingConfig] = useState<DeliveryPricingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<'zones' | 'sectors' | 'pricing'>('zones');

  // Simulateur
  const [simSector1, setSimSector1] = useState<DeliverySector | null>(null);
  const [simSector2, setSimSector2] = useState<DeliverySector | null>(null);

  // Formulaire nouveau secteur
  const [showAddSector, setShowAddSector] = useState(false);
  const [newSector, setNewSector] = useState({ commune: '', name: '', latitude: '', longitude: '', zone_id: '' });

  // Config tarifaire editable
  const [editConfig, setEditConfig] = useState({
    base_fee: '',
    per_km_rate: '',
    road_factor: '',
    rounding: '',
    min_price: '',
    max_price: '',
  });

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [zonesRes, sectorsRes, configRes] = await Promise.all([
        supabase.from('delivery_zones').select('*').order('display_order'),
        supabase.from('delivery_sectors').select('*').order('commune').order('display_order'),
        supabase.from('delivery_pricing_config').select('*').limit(1).single(),
      ]);

      if (zonesRes.data) setZones(zonesRes.data);
      if (sectorsRes.data) setSectors(sectorsRes.data);
      if (configRes.data) {
        setPricingConfig(configRes.data);
        setEditConfig({
          base_fee: configRes.data.base_fee.toString(),
          per_km_rate: configRes.data.per_km_rate.toString(),
          road_factor: configRes.data.road_factor.toString(),
          rounding: configRes.data.rounding.toString(),
          min_price: configRes.data.min_price.toString(),
          max_price: configRes.data.max_price.toString(),
        });
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  const toggleZone = async (zoneId: string, isActive: boolean) => {
    try {
      await supabase.from('delivery_zones').update({ is_active: !isActive }).eq('id', zoneId);
      toast.success(`Zone ${!isActive ? 'activee' : 'desactivee'}`);
      loadData(true);
    } catch (error) {
      toast.error('Erreur mise a jour zone');
    }
  };

  const toggleSector = async (sectorId: string, isActive: boolean) => {
    try {
      await supabase.from('delivery_sectors').update({ is_active: !isActive }).eq('id', sectorId);
      toast.success(`Secteur ${!isActive ? 'active' : 'desactive'}`);
      loadData(true);
    } catch (error) {
      toast.error('Erreur mise a jour secteur');
    }
  };

  const handleAddSector = async () => {
    if (!newSector.commune || !newSector.name || !newSector.latitude || !newSector.longitude || !newSector.zone_id) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    try {
      const slug = newSector.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const { error } = await supabase.from('delivery_sectors').insert({
        zone_id: newSector.zone_id,
        commune: newSector.commune,
        name: newSector.name,
        slug,
        latitude: parseFloat(newSector.latitude),
        longitude: parseFloat(newSector.longitude),
      });

      if (error) throw error;
      toast.success('Secteur ajoute');
      setShowAddSector(false);
      setNewSector({ commune: '', name: '', latitude: '', longitude: '', zone_id: '' });
      loadData(true);
    } catch (error: any) {
      toast.error(error.message || 'Erreur ajout secteur');
    }
  };

  const handleSaveConfig = async () => {
    if (!pricingConfig) return;

    try {
      const updates = {
        base_fee: parseInt(editConfig.base_fee) || 500,
        per_km_rate: parseInt(editConfig.per_km_rate) || 100,
        road_factor: parseFloat(editConfig.road_factor) || 1.4,
        rounding: parseInt(editConfig.rounding) || 500,
        min_price: parseInt(editConfig.min_price) || 1000,
        max_price: parseInt(editConfig.max_price) || 5000,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('delivery_pricing_config')
        .update(updates)
        .eq('id', pricingConfig.id);

      if (error) throw error;
      toast.success('Configuration tarifaire mise a jour');
      loadData(true);
    } catch (error) {
      toast.error('Erreur sauvegarde configuration');
    }
  };

  // Simulateur de prix
  const simulatedResult = (() => {
    if (!simSector1 || !simSector2 || !pricingConfig) return null;
    return calculateExpressPriceFromCoords(
      simSector1.latitude, simSector1.longitude,
      simSector2.latitude, simSector2.longitude,
      pricingConfig
    );
  })();

  // Grouper secteurs par commune
  const sectorsByCommune = sectors.reduce((acc, sector) => {
    if (!acc[sector.commune]) acc[sector.commune] = [];
    acc[sector.commune].push(sector);
    return acc;
  }, {} as Record<string, DeliverySector[]>);

  const sections = [
    { key: 'zones' as const, label: 'Zones', icon: 'map' },
    { key: 'sectors' as const, label: 'Secteurs', icon: 'location' },
    { key: 'pricing' as const, label: 'Tarifs', icon: 'calculator' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Zones & Secteurs</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {sections.map((section) => (
          <TouchableOpacity
            key={section.key}
            style={[styles.tab, activeSection === section.key && styles.tabActive]}
            onPress={() => setActiveSection(section.key)}
          >
            <Ionicons name={section.icon as any} size={16} color={activeSection === section.key ? '#047857' : '#6b7280'} />
            <Text style={[styles.tabText, activeSection === section.key && styles.tabTextActive]}>{section.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
      >
        {/* Section Zones */}
        {activeSection === 'zones' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Zones de livraison ({zones.length})</Text>
            {zones.map((zone) => (
              <View key={zone.id} style={styles.itemCard}>
                <View style={styles.itemInfo}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemName}>{zone.name} ({zone.code})</Text>
                    <Switch
                      value={zone.is_active}
                      onValueChange={() => toggleZone(zone.id, zone.is_active)}
                      color="#047857"
                    />
                  </View>
                  <Text style={styles.itemDetail}>Communes: {zone.communes.join(', ')}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Section Secteurs */}
        {activeSection === 'sectors' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Secteurs ({sectors.length})</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddSector(!showAddSector)}
              >
                <Ionicons name={showAddSector ? 'close' : 'add'} size={18} color="#fff" />
                <Text style={styles.addButtonText}>{showAddSector ? 'Annuler' : 'Ajouter'}</Text>
              </TouchableOpacity>
            </View>

            {/* Formulaire ajout */}
            {showAddSector && (
              <View style={styles.addForm}>
                <TextInput
                  label="Commune"
                  value={newSector.commune}
                  onChangeText={(v) => setNewSector({ ...newSector, commune: v })}
                  mode="outlined"
                  style={styles.input}
                />
                <TextInput
                  label="Nom du secteur"
                  value={newSector.name}
                  onChangeText={(v) => setNewSector({ ...newSector, name: v })}
                  mode="outlined"
                  style={styles.input}
                />
                <View style={styles.row}>
                  <TextInput
                    label="Latitude"
                    value={newSector.latitude}
                    onChangeText={(v) => setNewSector({ ...newSector, latitude: v })}
                    mode="outlined"
                    keyboardType="decimal-pad"
                    style={[styles.input, { flex: 1 }]}
                  />
                  <TextInput
                    label="Longitude"
                    value={newSector.longitude}
                    onChangeText={(v) => setNewSector({ ...newSector, longitude: v })}
                    mode="outlined"
                    keyboardType="decimal-pad"
                    style={[styles.input, { flex: 1 }]}
                  />
                </View>

                {/* Zone selection */}
                <Text style={styles.fieldLabel}>Zone :</Text>
                <View style={styles.zoneSelector}>
                  {zones.map((z) => (
                    <TouchableOpacity
                      key={z.id}
                      style={[styles.zoneOption, newSector.zone_id === z.id && styles.zoneOptionActive]}
                      onPress={() => setNewSector({ ...newSector, zone_id: z.id })}
                    >
                      <Text style={[styles.zoneOptionText, newSector.zone_id === z.id && styles.zoneOptionTextActive]}>
                        {z.code}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={styles.saveButton} onPress={handleAddSector}>
                  <Text style={styles.saveButtonText}>Ajouter le secteur</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Liste par commune */}
            {Object.entries(sectorsByCommune).map(([commune, communeSectors]) => (
              <View key={commune} style={styles.communeGroup}>
                <Text style={styles.communeTitle}>{commune} ({communeSectors.length})</Text>
                {communeSectors.map((sector) => (
                  <View key={sector.id} style={styles.sectorItem}>
                    <View style={styles.sectorInfo}>
                      <Text style={styles.sectorName}>{sector.name}</Text>
                      <Text style={styles.sectorCoords}>
                        {sector.latitude.toFixed(4)}, {sector.longitude.toFixed(4)}
                      </Text>
                    </View>
                    <Switch
                      value={sector.is_active}
                      onValueChange={() => toggleSector(sector.id, sector.is_active)}
                      color="#047857"
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Section Tarification */}
        {activeSection === 'pricing' && pricingConfig && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Configuration tarifaire</Text>
            <Text style={styles.formulaText}>
              prix = base + (distance x tarif/km x facteur route)
            </Text>

            <View style={styles.configGrid}>
              <View style={styles.configItem}>
                <Text style={styles.configLabel}>Tarif de base (FCFA)</Text>
                <TextInput
                  value={editConfig.base_fee}
                  onChangeText={(v) => setEditConfig({ ...editConfig, base_fee: v })}
                  mode="outlined"
                  keyboardType="number-pad"
                  style={styles.configInput}
                />
              </View>
              <View style={styles.configItem}>
                <Text style={styles.configLabel}>Tarif/km (FCFA)</Text>
                <TextInput
                  value={editConfig.per_km_rate}
                  onChangeText={(v) => setEditConfig({ ...editConfig, per_km_rate: v })}
                  mode="outlined"
                  keyboardType="number-pad"
                  style={styles.configInput}
                />
              </View>
              <View style={styles.configItem}>
                <Text style={styles.configLabel}>Facteur route</Text>
                <TextInput
                  value={editConfig.road_factor}
                  onChangeText={(v) => setEditConfig({ ...editConfig, road_factor: v })}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  style={styles.configInput}
                />
              </View>
              <View style={styles.configItem}>
                <Text style={styles.configLabel}>Arrondi (FCFA)</Text>
                <TextInput
                  value={editConfig.rounding}
                  onChangeText={(v) => setEditConfig({ ...editConfig, rounding: v })}
                  mode="outlined"
                  keyboardType="number-pad"
                  style={styles.configInput}
                />
              </View>
              <View style={styles.configItem}>
                <Text style={styles.configLabel}>Prix min (FCFA)</Text>
                <TextInput
                  value={editConfig.min_price}
                  onChangeText={(v) => setEditConfig({ ...editConfig, min_price: v })}
                  mode="outlined"
                  keyboardType="number-pad"
                  style={styles.configInput}
                />
              </View>
              <View style={styles.configItem}>
                <Text style={styles.configLabel}>Prix max (FCFA)</Text>
                <TextInput
                  value={editConfig.max_price}
                  onChangeText={(v) => setEditConfig({ ...editConfig, max_price: v })}
                  mode="outlined"
                  keyboardType="number-pad"
                  style={styles.configInput}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveConfig}>
              <Text style={styles.saveButtonText}>Sauvegarder la configuration</Text>
            </TouchableOpacity>

            {/* Simulateur */}
            <View style={styles.simulatorSection}>
              <Text style={styles.sectionTitle}>Simulateur de prix</Text>
              <Text style={styles.simulatorHint}>Selectionnez 2 secteurs pour voir le prix calcule</Text>

              <Text style={styles.fieldLabel}>Secteur depart :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectorScroll}>
                {sectors.filter(s => s.is_active).map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.sectorChip, simSector1?.id === s.id && styles.sectorChipActive]}
                    onPress={() => setSimSector1(s)}
                  >
                    <Text style={[styles.sectorChipText, simSector1?.id === s.id && styles.sectorChipTextActive]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Secteur arrivee :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectorScroll}>
                {sectors.filter(s => s.is_active).map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.sectorChip, simSector2?.id === s.id && styles.sectorChipActive]}
                    onPress={() => setSimSector2(s)}
                  >
                    <Text style={[styles.sectorChipText, simSector2?.id === s.id && styles.sectorChipTextActive]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {simulatedResult && (
                <View style={styles.simulatorResult}>
                  <Text style={styles.resultPrice}>{simulatedResult.price.toLocaleString()} FCFA</Text>
                  <Text style={styles.resultDetail}>
                    Distance : ~{simulatedResult.distanceKm} km (route : ~{simulatedResult.roadDistanceKm} km)
                  </Text>
                </View>
              )}
            </View>
          </View>
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
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    backgroundColor: '#d1fae5',
    borderWidth: 1.5,
    borderColor: '#6ee7b7',
  },
  tabText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#047857', fontWeight: '800' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 12 },
  formulaText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginBottom: 16,
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 8,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  itemInfo: { flex: 1 },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  itemDetail: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#047857',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  addForm: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  input: { marginBottom: 10, backgroundColor: '#fff' },
  row: { flexDirection: 'row', gap: 10 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 4 },
  zoneSelector: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  zoneOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  zoneOptionActive: { backgroundColor: '#d1fae5', borderColor: '#047857' },
  zoneOptionText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  zoneOptionTextActive: { color: '#047857', fontWeight: '800' },
  saveButton: {
    backgroundColor: '#047857',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  communeGroup: { marginBottom: 16 },
  communeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#047857',
    marginBottom: 8,
    paddingLeft: 4,
  },
  sectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    elevation: 1,
  },
  sectorInfo: { flex: 1 },
  sectorName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  sectorCoords: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  configGrid: { gap: 10, marginBottom: 12 },
  configItem: {},
  configLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 4 },
  configInput: { backgroundColor: '#fff' },
  simulatorSection: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    elevation: 2,
  },
  simulatorHint: { fontSize: 12, color: '#6b7280', marginBottom: 12 },
  sectorScroll: { marginBottom: 8 },
  sectorChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectorChipActive: { backgroundColor: '#d1fae5', borderColor: '#047857' },
  sectorChipText: { fontSize: 11, fontWeight: '600', color: '#6b7280' },
  sectorChipTextActive: { color: '#047857', fontWeight: '800' },
  simulatorResult: {
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    padding: 16,
    marginTop: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  resultPrice: { fontSize: 28, fontWeight: '900', color: '#047857' },
  resultDetail: { fontSize: 12, color: '#6b7280', marginTop: 4 },
});
