import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Text, Badge } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { toast } from '../../stores/toastStore';
import AppHeader from '../../components/AppHeader';

interface ServiceType {
  id: string;
  key: string;
  label: string;
  icon: string;
  color: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

const ICON_OPTIONS = [
  'business', 'shield-checkmark', 'hammer', 'school', 'medkit',
  'home', 'briefcase', 'car', 'airplane', 'planet',
];

const COLOR_OPTIONS = [
  { name: 'Bleu', value: '#2563eb' },
  { name: 'Vert', value: '#047857' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Rouge', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Rose', value: '#db2777' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Cyan', value: '#0891b2' },
];

export default function ServiceTypesScreen({ navigation }: any) {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingType, setEditingType] = useState<ServiceType | null>(null);
  const [formData, setFormData] = useState({
    key: '',
    label: '',
    icon: 'business',
    color: '#2563eb',
  });
  const [saving, setSaving] = useState(false);

  const loadServiceTypes = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;

      setServiceTypes(data || []);
    } catch (error: any) {
      console.error('Erreur chargement types services:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadServiceTypes();
  }, []);

  const handleRefresh = useCallback(() => {
    loadServiceTypes(true);
  }, [loadServiceTypes]);

  const handleOpenModal = (type?: ServiceType) => {
    if (type) {
      setEditingType(type);
      setFormData({
        key: type.key,
        label: type.label,
        icon: type.icon,
        color: type.color,
      });
    } else {
      setEditingType(null);
      setFormData({
        key: '',
        label: '',
        icon: 'business',
        color: '#2563eb',
      });
    }
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingType(null);
    setFormData({ key: '', label: '', icon: 'business', color: '#2563eb' });
  };

  const handleSave = async () => {
    try {
      if (!formData.key.trim() || !formData.label.trim()) {
        toast.error('Clé et libellé sont obligatoires');
        return;
      }

      setSaving(true);

      if (editingType) {
        // Update existing type
        const { error } = await supabase
          .from('service_types')
          .update({
            key: formData.key.trim(),
            label: formData.label.trim(),
            icon: formData.icon,
            color: formData.color,
          })
          .eq('id', editingType.id);

        if (error) throw error;
        toast.success('Type de service modifié');
      } else {
        // Create new type
        const maxOrder = serviceTypes.length > 0
          ? Math.max(...serviceTypes.map(t => t.display_order))
          : 0;

        const { error } = await supabase
          .from('service_types')
          .insert({
            key: formData.key.trim(),
            label: formData.label.trim(),
            icon: formData.icon,
            color: formData.color,
            display_order: maxOrder + 1,
            is_active: true,
          });

        if (error) throw error;
        toast.success('Type de service créé');
      }

      handleCloseModal();
      loadServiceTypes();
    } catch (error: any) {
      console.error('Erreur sauvegarde:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (type: ServiceType) => {
    try {
      const { error } = await supabase
        .from('service_types')
        .update({ is_active: !type.is_active })
        .eq('id', type.id);

      if (error) throw error;

      toast.success(
        type.is_active
          ? 'Type de service désactivé'
          : 'Type de service activé'
      );
      loadServiceTypes();
    } catch (error: any) {
      console.error('Erreur mise à jour:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleMoveUp = async (type: ServiceType, index: number) => {
    if (index === 0) return;

    try {
      const previousType = serviceTypes[index - 1];

      await supabase
        .from('service_types')
        .update({ display_order: previousType.display_order })
        .eq('id', type.id);

      await supabase
        .from('service_types')
        .update({ display_order: type.display_order })
        .eq('id', previousType.id);

      loadServiceTypes();
    } catch (error: any) {
      console.error('Erreur réorganisation:', error);
      toast.error('Erreur lors de la réorganisation');
    }
  };

  const handleMoveDown = async (type: ServiceType, index: number) => {
    if (index === serviceTypes.length - 1) return;

    try {
      const nextType = serviceTypes[index + 1];

      await supabase
        .from('service_types')
        .update({ display_order: nextType.display_order })
        .eq('id', type.id);

      await supabase
        .from('service_types')
        .update({ display_order: type.display_order })
        .eq('id', nextType.id);

      loadServiceTypes();
    } catch (error: any) {
      console.error('Erreur réorganisation:', error);
      toast.error('Erreur lors de la réorganisation');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  const activeCount = serviceTypes.filter(t => t.is_active).length;
  const inactiveCount = serviceTypes.length - activeCount;

  return (
    <View style={styles.container}>
      <AppHeader
        title="Types de services"
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
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
            <Ionicons name="apps" size={24} color="#2563eb" />
            <Text style={styles.statValue}>{serviceTypes.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#dcfce7' }]}>
            <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
            <Text style={styles.statValue}>{activeCount}</Text>
            <Text style={styles.statLabel}>Actifs</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="close-circle" size={24} color="#dc2626" />
            <Text style={styles.statValue}>{inactiveCount}</Text>
            <Text style={styles.statLabel}>Inactifs</Text>
          </View>
        </View>

        {/* Service Types List */}
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>
            {serviceTypes.length} type{serviceTypes.length > 1 ? 's' : ''}
          </Text>

          {serviceTypes.map((type, index) => (
            <View key={type.id} style={styles.typeCard}>
              <View style={styles.typeHeader}>
                <View style={[styles.typeIcon, { backgroundColor: `${type.color}20` }]}>
                  <Ionicons name={type.icon as any} size={24} color={type.color} />
                </View>
                <View style={styles.typeInfo}>
                  <View style={styles.typeNameRow}>
                    <Text style={styles.typeName}>{type.label}</Text>
                    {type.is_active ? (
                      <Badge style={styles.badgeActive}>Actif</Badge>
                    ) : (
                      <Badge style={styles.badgeInactive}>Inactif</Badge>
                    )}
                  </View>
                  <Text style={styles.typeKey}>{type.key}</Text>
                  <View style={styles.typeMetaRow}>
                    <View style={styles.typeMeta}>
                      <View style={[styles.colorPreview, { backgroundColor: type.color }]} />
                      <Text style={styles.typeMetaText}>{type.color}</Text>
                    </View>
                    <View style={styles.typeMeta}>
                      <Ionicons name={type.icon as any} size={14} color="#6b7280" />
                      <Text style={styles.typeMetaText}>{type.icon}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.typeActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleMoveUp(type, index)}
                  disabled={index === 0}
                >
                  <Ionicons
                    name="chevron-up"
                    size={20}
                    color={index === 0 ? '#d1d5db' : '#6b7280'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleMoveDown(type, index)}
                  disabled={index === serviceTypes.length - 1}
                >
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color={index === serviceTypes.length - 1 ? '#d1d5db' : '#6b7280'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleToggleActive(type)}
                >
                  <Ionicons
                    name={type.is_active ? 'toggle' : 'toggle-outline'}
                    size={28}
                    color={type.is_active ? '#047857' : '#9ca3af'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleOpenModal(type)}
                >
                  <Ionicons name="create" size={20} color="#2563eb" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => handleOpenModal()}
      >
        <Ionicons name="add" size={24} color="#ffffff" />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingType ? 'Modifier le type' : 'Nouveau type de service'}
              </Text>
              <TouchableOpacity onPress={handleCloseModal}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Clé technique *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ex: prefecture"
                  value={formData.key}
                  onChangeText={(text) => setFormData({ ...formData, key: text })}
                  placeholderTextColor="#9ca3af"
                  editable={!editingType}
                />
                <Text style={styles.hint}>
                  Utilisée en interne, pas d'espaces ni caractères spéciaux
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Libellé *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ex: Préfecture"
                  value={formData.label}
                  onChangeText={(text) => setFormData({ ...formData, label: text })}
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Icône</Text>
                <View style={styles.iconGrid}>
                  {ICON_OPTIONS.map((iconName) => (
                    <TouchableOpacity
                      key={iconName}
                      style={[
                        styles.iconOption,
                        formData.icon === iconName && { backgroundColor: formData.color },
                      ]}
                      onPress={() => setFormData({ ...formData, icon: iconName })}
                    >
                      <Ionicons
                        name={iconName as any}
                        size={24}
                        color={formData.icon === iconName ? '#ffffff' : '#6b7280'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Couleur</Text>
                <View style={styles.colorGrid}>
                  {COLOR_OPTIONS.map((colorOption) => (
                    <TouchableOpacity
                      key={colorOption.value}
                      style={[
                        styles.colorOption,
                        { backgroundColor: colorOption.value },
                        formData.color === colorOption.value && styles.colorOptionSelected,
                      ]}
                      onPress={() => setFormData({ ...formData, color: colorOption.value })}
                    >
                      {formData.color === colorOption.value && (
                        <Ionicons name="checkmark" size={20} color="#ffffff" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Preview */}
              <View style={styles.previewSection}>
                <Text style={styles.label}>Aperçu</Text>
                <View style={styles.previewCard}>
                  <View style={[styles.previewIcon, { backgroundColor: `${formData.color}20` }]}>
                    <Ionicons name={formData.icon as any} size={32} color={formData.color} />
                  </View>
                  <Text style={styles.previewLabel}>{formData.label || 'Libellé'}</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCloseModal}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingType ? 'Modifier' : 'Créer'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 100,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
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
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginTop: 4,
  },
  listContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  typeCard: {
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
  typeHeader: {
    flex: 1,
    flexDirection: 'row',
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  typeInfo: {
    flex: 1,
  },
  typeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  typeName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginRight: 8,
    flex: 1,
  },
  typeKey: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  typeMetaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeMetaText: {
    fontSize: 11,
    color: '#6b7280',
  },
  colorPreview: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  badgeActive: {
    backgroundColor: '#d1fae5',
    color: '#047857',
    fontSize: 10,
  },
  badgeInactive: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    fontSize: 10,
  },
  typeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    padding: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  modalForm: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#ffffff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  previewSection: {
    marginTop: 8,
  },
  previewCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  previewIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6b7280',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#047857',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
