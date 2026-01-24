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

interface DocumentType {
  id: string;
  key: string;
  label: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export default function DocumentTypesScreen({ navigation }: any) {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingType, setEditingType] = useState<DocumentType | null>(null);
  const [formData, setFormData] = useState({
    key: '',
    label: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const loadDocumentTypes = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;

      setDocumentTypes(data || []);
    } catch (error: any) {
      console.error('Erreur chargement types documents:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDocumentTypes();
  }, []);

  const handleRefresh = useCallback(() => {
    loadDocumentTypes(true);
  }, [loadDocumentTypes]);

  const handleOpenModal = (type?: DocumentType) => {
    if (type) {
      setEditingType(type);
      setFormData({
        key: type.key,
        label: type.label,
        description: type.description || '',
      });
    } else {
      setEditingType(null);
      setFormData({
        key: '',
        label: '',
        description: '',
      });
    }
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingType(null);
    setFormData({ key: '', label: '', description: '' });
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
          .from('document_types')
          .update({
            key: formData.key.trim(),
            label: formData.label.trim(),
            description: formData.description.trim() || null,
          })
          .eq('id', editingType.id);

        if (error) throw error;
        toast.success('Type de document modifié');
      } else {
        // Create new type
        const maxOrder = documentTypes.length > 0
          ? Math.max(...documentTypes.map(t => t.display_order))
          : 0;

        const { error } = await supabase
          .from('document_types')
          .insert({
            key: formData.key.trim(),
            label: formData.label.trim(),
            description: formData.description.trim() || null,
            display_order: maxOrder + 1,
            is_active: true,
          });

        if (error) throw error;
        toast.success('Type de document créé');
      }

      handleCloseModal();
      loadDocumentTypes();
    } catch (error: any) {
      console.error('Erreur sauvegarde:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (type: DocumentType) => {
    try {
      const { error } = await supabase
        .from('document_types')
        .update({ is_active: !type.is_active })
        .eq('id', type.id);

      if (error) throw error;

      toast.success(
        type.is_active
          ? 'Type de document désactivé'
          : 'Type de document activé'
      );
      loadDocumentTypes();
    } catch (error: any) {
      console.error('Erreur mise à jour:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleMoveUp = async (type: DocumentType, index: number) => {
    if (index === 0) return;

    try {
      const previousType = documentTypes[index - 1];

      await supabase
        .from('document_types')
        .update({ display_order: previousType.display_order })
        .eq('id', type.id);

      await supabase
        .from('document_types')
        .update({ display_order: type.display_order })
        .eq('id', previousType.id);

      loadDocumentTypes();
    } catch (error: any) {
      console.error('Erreur réorganisation:', error);
      toast.error('Erreur lors de la réorganisation');
    }
  };

  const handleMoveDown = async (type: DocumentType, index: number) => {
    if (index === documentTypes.length - 1) return;

    try {
      const nextType = documentTypes[index + 1];

      await supabase
        .from('document_types')
        .update({ display_order: nextType.display_order })
        .eq('id', type.id);

      await supabase
        .from('document_types')
        .update({ display_order: type.display_order })
        .eq('id', nextType.id);

      loadDocumentTypes();
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

  const activeCount = documentTypes.filter(t => t.is_active).length;
  const inactiveCount = documentTypes.length - activeCount;

  return (
    <View style={styles.container}>
      <AppHeader
        title="Types de documents"
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
            <Ionicons name="document-text" size={24} color="#2563eb" />
            <Text style={styles.statValue}>{documentTypes.length}</Text>
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

        {/* Document Types List */}
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>
            {documentTypes.length} type{documentTypes.length > 1 ? 's' : ''}
          </Text>

          {documentTypes.map((type, index) => (
            <View key={type.id} style={styles.typeCard}>
              <View style={styles.typeHeader}>
                <View style={styles.typeIcon}>
                  <Ionicons name="document-text" size={24} color="#2563eb" />
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
                  {type.description && (
                    <Text style={styles.typeDescription}>{type.description}</Text>
                  )}
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
                  disabled={index === documentTypes.length - 1}
                >
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color={index === documentTypes.length - 1 ? '#d1d5db' : '#6b7280'}
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
                {editingType ? 'Modifier le type' : 'Nouveau type de document'}
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
                  placeholder="ex: certificat_naissance"
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
                  placeholder="ex: Certificat de naissance"
                  value={formData.label}
                  onChangeText={(text) => setFormData({ ...formData, label: text })}
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Description (optionnel)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Description du type de document..."
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                />
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
    backgroundColor: '#dbeafe',
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
  typeDescription: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
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
    maxHeight: '80%',
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
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
