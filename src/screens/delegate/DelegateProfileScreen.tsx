import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { useDashboardStore } from '../../stores/dashboardStore';
import { supabase } from '../../config/supabase';
import { toast } from '../../stores/toastStore';

export default function DelegateProfileScreen({ navigation }: any) {
  const { user, profile, updateProfile, signOut } = useAuthStore();
  const { setMode } = useDashboardStore();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalMissions: 0,
    completedMissions: 0,
    activeMissions: 0,
  });

  const [delegateInfo, setDelegateInfo] = useState<{
    city: string;
    services: string[];
    rating: number;
  } | null>(null);

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
    loadStats();
    loadDelegateInfo();
  }, [profile]);

  const loadDelegateInfo = async () => {
    try {
      const { data: delegate, error } = await supabase
        .from('delegates')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        console.error('Erreur chargement délégué:', error);
        throw error;
      }

      if (delegate) {
        setDelegateInfo({
          city: delegate.city || '',
          services: delegate.services || [],
          rating: delegate.rating || 0,
        });
      }
    } catch (error) {
      console.error('Erreur chargement info délégué:', error);
    }
  };

  const loadStats = async () => {
    try {
      // Récupérer d'abord l'ID du délégué
      const { data: delegate, error: delegateError } = await supabase
        .from('delegates')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (delegateError) throw delegateError;

      // Charger les statistiques du délégué
      const { data: requests, error } = await supabase
        .from('requests')
        .select('status')
        .eq('delegate_id', delegate.id);

      if (error) throw error;

      const totalMissions = requests?.length || 0;
      const completedMissions = requests?.filter((r) => r.status === 'completed').length || 0;
      const activeMissions = requests?.filter((r) =>
        r.status === 'in_progress' || r.status === 'assigned'
      ).length || 0;

      setStats({
        totalMissions,
        completedMissions,
        activeMissions,
      });
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  };

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
            } catch (error) {
              console.error('Erreur déconnexion:', error);
              toast.error('Erreur lors de la déconnexion');
            }
          },
        },
      ]
    );
  };

  const formatService = (service: string) => {
    const serviceMap: { [key: string]: string } = {
      'mairie': 'Mairie',
      'sous_prefecture': 'Sous-préfecture',
      'justice': 'Justice',
      'mairie/sous-préfecture': 'Mairie/Sous-préfecture',
    };
    return serviceMap[service] || service;
  };

  const handleSwitchToUserDashboard = async () => {
    try {
      await setMode('user');
      toast.success('Passage au mode utilisateur');
    } catch (error) {
      console.error('Erreur changement de mode:', error);
      toast.error('Erreur lors du changement de mode');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Mon Profil</Text>
          <Text style={styles.headerSubtitle}>Délégué certifié</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Badge Délégué */}
        <View style={styles.badgeCard}>
          <View style={styles.orangeAccent} />
          <View style={styles.badgeHeader}>
            <View style={styles.badgeIconContainer}>
              <Ionicons name="shield-checkmark" size={32} color="#f59e0b" />
            </View>
            <View style={styles.badgeTextContainer}>
              <Text style={styles.badgeTitle}>Délégué Certifié</Text>
              <Text style={styles.badgeSubtitle}>Professionnel vérifié</Text>
            </View>
          </View>

          <View style={styles.badgeInfoGrid}>
            {/* Ville */}
            <View style={styles.badgeInfoItem}>
              <View style={styles.badgeInfoIcon}>
                <Ionicons name="location" size={20} color="#f59e0b" />
              </View>
              <View style={styles.badgeInfoText}>
                <Text style={styles.badgeInfoLabel}>Ville d'opération</Text>
                <Text style={styles.badgeInfoValue}>
                  {delegateInfo?.city || 'Non renseignée'}
                </Text>
              </View>
            </View>

            {/* Services */}
            <View style={styles.badgeInfoItem}>
              <View style={styles.badgeInfoIcon}>
                <Ionicons name="briefcase" size={20} color="#f59e0b" />
              </View>
              <View style={styles.badgeInfoText}>
                <Text style={styles.badgeInfoLabel}>Services</Text>
                <Text style={styles.badgeInfoValue}>
                  {delegateInfo?.services && delegateInfo.services.length > 0
                    ? delegateInfo.services.map(formatService).join(', ')
                    : 'Non renseigné'}
                </Text>
              </View>
            </View>

            {/* Note */}
            {delegateInfo?.rating !== undefined && delegateInfo.rating > 0 && (
              <View style={styles.badgeInfoItem}>
                <View style={styles.badgeInfoIcon}>
                  <Ionicons name="star" size={20} color="#f59e0b" />
                </View>
                <View style={styles.badgeInfoText}>
                  <Text style={styles.badgeInfoLabel}>Note moyenne</Text>
                  <Text style={styles.badgeInfoValue}>
                    {delegateInfo.rating.toFixed(1)} / 5
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Statistiques */}
        <View style={styles.statsCard}>
          <View style={styles.orangeAccent} />
          <Text style={styles.statsTitle}>Mes statistiques</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <View style={[styles.statIconContainer, { backgroundColor: '#fff7ed' }]}>
                <Ionicons name="briefcase" size={24} color="#f59e0b" />
              </View>
              <Text style={styles.statValue}>{stats.totalMissions}</Text>
              <Text style={styles.statLabel}>Total missions</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIconContainer, { backgroundColor: '#ecfdf5' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              </View>
              <Text style={styles.statValue}>{stats.completedMissions}</Text>
              <Text style={styles.statLabel}>Complétées</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIconContainer, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="time" size={24} color="#3b82f6" />
              </View>
              <Text style={styles.statValue}>{stats.activeMissions}</Text>
              <Text style={styles.statLabel}>En cours</Text>
            </View>
          </View>
        </View>

        {/* Informations personnelles */}
        <View style={styles.sectionCard}>
          <View style={styles.orangeAccent} />
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="person" size={20} color="#f59e0b" />
              </View>
              <Text style={styles.sectionTitle}>Informations personnelles</Text>
            </View>
            {!isEditing ? (
              <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
                <Ionicons name="pencil" size={16} color="#f59e0b" />
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
                <Ionicons name="person-outline" size={14} color="#f59e0b" /> Nom complet
              </Text>
              {isEditing ? (
                <TextInput
                  value={formData.name}
                  onChangeText={(value) => setFormData({ ...formData, name: value })}
                  mode="outlined"
                  style={styles.input}
                  placeholder="Votre nom complet"
                  outlineColor="#e5e7eb"
                  activeOutlineColor="#f59e0b"
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
                <Ionicons name="mail-outline" size={14} color="#f59e0b" /> Email
              </Text>
              <View style={styles.fieldValue}>
                <Text style={styles.fieldValueText}>{user?.email || 'Non renseigné'}</Text>
              </View>
              <Text style={styles.fieldNote}>L'email ne peut pas être modifié</Text>
            </View>

            {/* Téléphone */}
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>
                <Ionicons name="call-outline" size={14} color="#f59e0b" /> Téléphone
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
                  activeOutlineColor="#f59e0b"
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
                <Ionicons name="location-outline" size={14} color="#f59e0b" /> Ville
              </Text>
              {isEditing ? (
                <TextInput
                  value={formData.city}
                  onChangeText={(value) => setFormData({ ...formData, city: value })}
                  mode="outlined"
                  style={styles.input}
                  placeholder="Votre ville"
                  outlineColor="#e5e7eb"
                  activeOutlineColor="#f59e0b"
                />
              ) : (
                <View style={styles.fieldValue}>
                  <Text style={styles.fieldValueText}>{profile?.city || 'Non renseigné'}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Changement de dashboard */}
        <View style={styles.sectionCard}>
          <View style={styles.orangeAccent} />
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="swap-horizontal" size={20} color="#3b82f6" />
              </View>
              <Text style={styles.sectionTitle}>Changer de mode</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.switchButton} onPress={handleSwitchToUserDashboard}>
            <View style={styles.switchButtonContent}>
              <Ionicons name="person-outline" size={24} color="#3b82f6" />
              <View style={styles.switchButtonText}>
                <Text style={styles.switchButtonTitle}>Passer en mode utilisateur</Text>
                <Text style={styles.switchButtonSubtitle}>Accéder au dashboard utilisateur</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#3b82f6" />
          </TouchableOpacity>

          <Text style={styles.switchNote}>
            Vous pouvez basculer entre vos deux espaces à tout moment
          </Text>
        </View>

        {/* Bouton de déconnexion */}
        <View style={styles.sectionCard}>
          <View style={styles.orangeAccent} />
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
    backgroundColor: '#fffbeb',
  },
  header: {
    backgroundColor: '#f59e0b',
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    borderBottomWidth: 3,
    borderBottomColor: '#d97706',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
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
  badgeCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    padding: 24,
    elevation: 5,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.08)',
    overflow: 'hidden',
  },
  badgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 20,
    gap: 16,
  },
  badgeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  badgeTextContainer: {
    flex: 1,
  },
  badgeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f59e0b',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  badgeSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  badgeInfoGrid: {
    gap: 16,
  },
  badgeInfoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.15)',
    gap: 12,
  },
  badgeInfoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeInfoText: {
    flex: 1,
  },
  badgeInfoLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeInfoValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '700',
    lineHeight: 20,
  },
  statsCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    padding: 24,
    elevation: 5,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.08)',
    overflow: 'hidden',
  },
  orangeAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: '#f59e0b',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f59e0b',
    marginTop: 6,
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    padding: 24,
    elevation: 5,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.08)',
    overflow: 'hidden',
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
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f59e0b',
    letterSpacing: 0.2,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
  },
  editButtonText: {
    color: '#f59e0b',
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
    backgroundColor: '#f59e0b',
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
    color: '#f59e0b',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  fieldValue: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.15)',
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
    backgroundColor: '#fffbeb',
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
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#bfdbfe',
    elevation: 3,
    shadowColor: '#3b82f6',
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
    color: '#3b82f6',
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
