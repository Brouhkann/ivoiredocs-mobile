import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { useDashboardStore } from '../../stores/dashboardStore';
import { supabase } from '../../config/supabase';
import { toast } from '../../stores/toastStore';

export default function ProfileScreen({ navigation }: any) {
  const { user, profile, updateProfile, signOut } = useAuthStore();
  const { setMode } = useDashboardStore();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
    city: profile?.city || '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        phone: profile.phone || '',
        city: profile.city || '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('users')
        .update({
          name: formData.name,
          phone: formData.phone,
          city: formData.city,
        })
        .eq('id', user?.id);

      if (error) throw error;

      // Mettre à jour le store local
      await updateProfile();
      setIsEditing(false);
      toast.success('Profil mis à jour avec succès');
    } catch (error: any) {
      console.error('Erreur mise à jour profil:', error);
      toast.error('Impossible de sauvegarder vos modifications');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: profile?.name || '',
      phone: profile?.phone || '',
      city: profile?.city || '',
    });
    setIsEditing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              // La navigation vers Auth se fera automatiquement via RootNavigator
            } catch (error) {
              console.error('Erreur déconnexion:', error);
              toast.error('Erreur lors de la déconnexion');
            }
          },
        },
      ]
    );
  };

  const handleSwitchToDelegateDashboard = async () => {
    try {
      await setMode('delegate');
      toast.success('Passage au mode délégué');
    } catch (error) {
      console.error('Erreur changement de mode:', error);
      toast.error('Erreur lors du changement de mode');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Mon Profil</Text>
          <Text style={styles.headerSubtitle}>Gérez vos informations</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Informations personnelles */}
        <View style={styles.sectionCard}>
          <View style={styles.goldAccent} />
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="person" size={20} color="#047857" />
              </View>
              <Text style={styles.sectionTitle}>Informations personnelles</Text>
            </View>
            {!isEditing ? (
              <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
                <Ionicons name="pencil" size={16} color="#047857" />
                <Text style={styles.editButtonText}>Modifier</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.editActions}>
                <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={loading}
                  style={styles.saveButton}
                >
                  <Text style={styles.saveButtonText}>
                    {loading ? 'Sauvegarde...' : 'Sauvegarder'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.formGrid}>
            {/* Nom complet */}
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>
                <Ionicons name="person-outline" size={14} color="#047857" /> Nom complet
              </Text>
              {isEditing ? (
                <TextInput
                  value={formData.name}
                  onChangeText={(value) => setFormData({ ...formData, name: value })}
                  mode="outlined"
                  style={styles.input}
                  placeholder="Votre nom complet"
                  outlineColor="#e5e7eb"
                  activeOutlineColor="#047857"
                />
              ) : (
                <View style={styles.fieldValue}>
                  <Text style={styles.fieldValueText}>{profile?.name || 'Non renseigné'}</Text>
                </View>
              )}
            </View>

            {/* Email */}
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>
                <Ionicons name="mail-outline" size={14} color="#047857" /> Email
              </Text>
              <View style={styles.fieldValue}>
                <Text style={styles.fieldValueText}>{user?.email || 'Non renseigné'}</Text>
              </View>
              <Text style={styles.fieldNote}>L'email ne peut pas être modifié</Text>
            </View>

            {/* Téléphone */}
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>
                <Ionicons name="call-outline" size={14} color="#047857" /> Téléphone
              </Text>
              {isEditing ? (
                <TextInput
                  value={formData.phone}
                  onChangeText={(value) => setFormData({ ...formData, phone: value })}
                  mode="outlined"
                  style={styles.input}
                  placeholder="Votre numéro de téléphone"
                  keyboardType="phone-pad"
                  outlineColor="#e5e7eb"
                  activeOutlineColor="#047857"
                />
              ) : (
                <View style={styles.fieldValue}>
                  <Text style={styles.fieldValueText}>{profile?.phone || 'Non renseigné'}</Text>
                </View>
              )}
            </View>

            {/* Ville */}
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>
                <Ionicons name="location-outline" size={14} color="#047857" /> Ville
              </Text>
              {isEditing ? (
                <TextInput
                  value={formData.city}
                  onChangeText={(value) => setFormData({ ...formData, city: value })}
                  mode="outlined"
                  style={styles.input}
                  placeholder="Votre ville"
                  outlineColor="#e5e7eb"
                  activeOutlineColor="#047857"
                />
              ) : (
                <View style={styles.fieldValue}>
                  <Text style={styles.fieldValueText}>{profile?.city || 'Non renseigné'}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Changement de dashboard (seulement pour les délégués) */}
        {profile?.role === 'delegate' && (
          <View style={styles.sectionCard}>
            <View style={styles.goldAccent} />
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <View style={[styles.iconContainer, { backgroundColor: '#fff7ed' }]}>
                  <Ionicons name="swap-horizontal" size={20} color="#f59e0b" />
                </View>
                <Text style={styles.sectionTitle}>Changer de mode</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.switchButton} onPress={handleSwitchToDelegateDashboard}>
              <View style={styles.switchButtonContent}>
                <Ionicons name="briefcase-outline" size={24} color="#f59e0b" />
                <View style={styles.switchButtonText}>
                  <Text style={styles.switchButtonTitle}>Passer en mode délégué</Text>
                  <Text style={styles.switchButtonSubtitle}>Accéder à vos missions</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#f59e0b" />
            </TouchableOpacity>

            <Text style={styles.switchNote}>
              Vous pouvez basculer entre vos deux espaces à tout moment
            </Text>
          </View>
        )}

        {/* Bouton de déconnexion */}
        <View style={styles.sectionCard}>
          <View style={styles.goldAccent} />
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#fee2e2' }]}>
                <Ionicons name="log-out" size={20} color="#dc2626" />
              </View>
              <Text style={styles.sectionTitle}>Compte</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <View style={styles.logoutButtonContent}>
              <Ionicons name="log-out-outline" size={24} color="#dc2626" />
              <Text style={styles.logoutButtonText}>Se déconnecter</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#dc2626" />
          </TouchableOpacity>

          <Text style={styles.logoutNote}>
            Vous serez redirigé vers la page de connexion
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0fdf4',
  },
  header: {
    backgroundColor: '#047857',
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    borderBottomWidth: 3,
    borderBottomColor: '#d4af37',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d4af37',
    elevation: 4,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  headerContent: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    marginTop: 3,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    padding: 24,
    elevation: 5,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.08)',
    overflow: 'hidden',
  },
  goldAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: '#d4af37',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#047857',
    letterSpacing: 0.2,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
  },
  editButtonText: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#047857',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  formGrid: {
    gap: 16,
  },
  formField: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#047857',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  fieldValue: {
    backgroundColor: '#f8fffe',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(4, 120, 87, 0.15)',
  },
  fieldValueText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  fieldNote: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: '#f8fffe',
    fontSize: 15,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#fecaca',
    elevation: 3,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  logoutButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoutButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#dc2626',
    letterSpacing: 0.3,
  },
  logoutNote: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff7ed',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#fed7aa',
    elevation: 3,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  switchButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  switchButtonText: {
    flex: 1,
  },
  switchButtonTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f59e0b',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  switchButtonSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  switchNote: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
