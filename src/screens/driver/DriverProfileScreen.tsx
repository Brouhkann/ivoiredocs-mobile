import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { useDashboardStore } from '../../stores/dashboardStore';
import { supabase } from '../../config/supabase';
import AppHeader from '../../components/AppHeader';

export default function DriverProfileScreen() {
  const { profile, signOut } = useAuthStore();
  const { setMode } = useDashboardStore();
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [zoneName, setZoneName] = useState('');

  useEffect(() => {
    loadDriverInfo();
  }, []);

  const loadDriverInfo = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*, delivery_zones(name, code)')
        .eq('user_id', profile.id)
        .single();

      if (error) throw error;
      setDriverInfo(data);
      if (data?.delivery_zones) {
        setZoneName(`${data.delivery_zones.name} (${data.delivery_zones.code})`);
      }
    } catch (error) {
      console.error('Erreur chargement profil livreur:', error);
    }
  };

  const handleSwitchToUser = async () => {
    await setMode('user');
  };

  return (
    <View style={styles.container}>
      <AppHeader userName={profile?.name?.split(' ')[0] || 'Livreur'} showLogo={true} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Avatar et nom */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#2563eb" />
          </View>
          <Text style={styles.profileName}>{profile?.name || 'Livreur'}</Text>
          <Text style={styles.profileRole}>Livreur Express</Text>
        </View>

        {/* Informations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>

          <View style={styles.infoItem}>
            <Ionicons name="call" size={20} color="#6b7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Telephone</Text>
              <Text style={styles.infoValue}>{profile?.phone || '-'}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="map" size={20} color="#6b7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Zone assignee</Text>
              <Text style={styles.infoValue}>{zoneName || 'Non assignee'}</Text>
            </View>
          </View>

          {driverInfo && (
            <>
              <View style={styles.infoItem}>
                <Ionicons name="bicycle" size={20} color="#6b7280" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Total livraisons</Text>
                  <Text style={styles.infoValue}>{driverInfo.total_deliveries || 0}</Text>
                </View>
              </View>

              <View style={styles.infoItem}>
                <Ionicons name="star" size={20} color="#6b7280" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Note</Text>
                  <Text style={styles.infoValue}>{driverInfo.rating?.toFixed(1) || '5.0'} / 5</Text>
                </View>
              </View>

              {driverInfo.mobile_money_contact && (
                <View style={styles.infoItem}>
                  <Ionicons name="wallet" size={20} color="#6b7280" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Mobile Money</Text>
                    <Text style={styles.infoValue}>{driverInfo.mobile_money_contact}</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          <TouchableOpacity style={styles.actionItem} onPress={handleSwitchToUser}>
            <Ionicons name="swap-horizontal" size={20} color="#2563eb" />
            <Text style={styles.actionText}>Mode utilisateur</Text>
            <Ionicons name="chevron-forward" size={18} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionItem, styles.logoutItem]} onPress={signOut}>
            <Ionicons name="log-out" size={20} color="#dc2626" />
            <Text style={[styles.actionText, styles.logoutText]}>Deconnexion</Text>
            <Ionicons name="chevron-forward" size={18} color="#dc2626" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  scrollContent: { paddingBottom: 40 },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileName: { fontSize: 20, fontWeight: '800', color: '#111827' },
  profileRole: { fontSize: 14, fontWeight: '600', color: '#2563eb', marginTop: 4 },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 14,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 16 },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  infoValue: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 2 },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  actionText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  logoutItem: { borderBottomWidth: 0 },
  logoutText: { color: '#dc2626' },
});
