import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image, Linking } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../config/supabase';
import { toast } from '../../stores/toastStore';
import Loading from '../../components/ui/Loading';

interface DotationItem {
  id: string;
  reference?: string;
  delegate_id: string;
  delegate_name: string;
  delegate_phone: string;
  document_type: string;
  city: string;
  delegate_earnings: number;
  delegate_payment_status: 'pending' | 'paid';
  delegate_payment_proof_url?: string;
  delegate_paid_at?: string;
  assigned_at: string;
}

export default function DelegateDotationsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dotations, setDotations] = useState<DotationItem[]>([]);
  const [filter, setFilter] = useState<'pending' | 'paid' | 'all'>('pending');
  const [selectedDotation, setSelectedDotation] = useState<DotationItem | null>(null);
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchDotations = async () => {
    try {
      // Récupérer les demandes assignées avec les infos du délégué
      let query = supabase
        .from('requests')
        .select(`
          id,
          delegate_id,
          document_type,
          city,
          delegate_earnings,
          delegate_payment_status,
          delegate_payment_proof_url,
          delegate_paid_at,
          assigned_at,
          delegates!inner(name, phone)
        `)
        .not('delegate_id', 'is', null)
        .in('status', ['assigned', 'in_progress', 'ready', 'shipped', 'delivered', 'completed']);

      if (filter === 'pending') {
        query = query.or('delegate_payment_status.is.null,delegate_payment_status.eq.pending');
      } else if (filter === 'paid') {
        query = query.eq('delegate_payment_status', 'paid');
      }

      const { data, error } = await query.order('assigned_at', { ascending: false });

      if (error) throw error;

      const formattedDotations: DotationItem[] = (data || []).map((item: any) => ({
        id: item.id,
        reference: `DOT-${item.id.substring(0, 8).toUpperCase()}`,
        delegate_id: item.delegate_id,
        delegate_name: item.delegates?.name || 'Inconnu',
        delegate_phone: item.delegates?.phone || '',
        document_type: item.document_type,
        city: item.city,
        delegate_earnings: item.delegate_earnings || 0,
        delegate_payment_status: item.delegate_payment_status || 'pending',
        delegate_payment_proof_url: item.delegate_payment_proof_url,
        delegate_paid_at: item.delegate_paid_at,
        assigned_at: item.assigned_at,
      }));

      setDotations(formattedDotations);
    } catch (error) {
      console.error('Erreur chargement dotations:', error);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDotations();
    }, [filter])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDotations();
  };

  // Ouvrir WhatsApp pour contacter le délégué
  const handleContactDelegate = (phone: string, name: string, amount: number) => {
    let formattedPhone = phone.replace(/[\s\-\.\(\)]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '225' + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('225') && !formattedPhone.startsWith('+225')) {
      formattedPhone = '225' + formattedPhone;
    }
    formattedPhone = formattedPhone.replace('+', '');

    const message = encodeURIComponent(
      `Bonjour ${name},\n\nVotre dotation de ${amount.toLocaleString()} FCFA pour la mission Ivoiredocs a été envoyée.\n\nMerci pour votre travail !`
    );
    Linking.openURL(`https://wa.me/${formattedPhone}?text=${message}`);
  };

  // Sélectionner une image de preuve
  const handleSelectProof = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Permission requise');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProofImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erreur sélection:', error);
    }
  };

  // Prendre une photo de preuve
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Permission requise');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProofImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erreur photo:', error);
    }
  };

  // Marquer comme payé
  const handleMarkAsPaid = async () => {
    if (!selectedDotation || !proofImage) {
      toast.error('Ajoutez une preuve de paiement');
      return;
    }

    try {
      setUploading(true);

      // Upload de la preuve
      const fileName = `delegate_payments/${selectedDotation.id}_${Date.now()}.jpg`;
      const response = await fetch(proofImage);
      const blob = await response.blob();

      const { data: uploadData } = await supabase.storage
        .from('documents')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

      // Mettre à jour la demande
      const { error: updateError } = await supabase
        .from('requests')
        .update({
          delegate_payment_status: 'paid',
          delegate_payment_proof_url: uploadData?.path || proofImage,
          delegate_paid_at: new Date().toISOString(),
        })
        .eq('id', selectedDotation.id);

      if (updateError) throw updateError;

      toast.success('Dotation marquée comme payée');
      setSelectedDotation(null);
      setProofImage(null);
      fetchDotations();
    } catch (error: any) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setUploading(false);
    }
  };

  // Fermer le modal
  const handleCloseModal = () => {
    setSelectedDotation(null);
    setProofImage(null);
  };

  const pendingCount = dotations.filter(d => d.delegate_payment_status === 'pending').length;
  const pendingTotal = dotations
    .filter(d => d.delegate_payment_status === 'pending')
    .reduce((sum, d) => sum + d.delegate_earnings, 0);

  if (loading) {
    return <Loading message="Chargement des dotations..." />;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dotations Délégués</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Résumé */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>À payer</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{pendingTotal.toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>FCFA total</Text>
        </View>
      </View>

      {/* Filtres */}
      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'pending' && styles.filterBtnActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
            À payer
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'paid' && styles.filterBtnActive]}
          onPress={() => setFilter('paid')}
        >
          <Text style={[styles.filterText, filter === 'paid' && styles.filterTextActive]}>
            Payées
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Toutes
          </Text>
        </TouchableOpacity>
      </View>

      {/* Liste */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#047857']} />
        }
      >
        {dotations.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>Aucune dotation</Text>
          </View>
        ) : (
          dotations.map((item) => (
            <View
              key={item.id}
              style={[
                styles.dotationCard,
                item.delegate_payment_status === 'paid' && styles.dotationCardPaid,
              ]}
            >
              <View style={styles.dotationHeader}>
                <View style={styles.delegateInfo}>
                  <View style={styles.delegateAvatar}>
                    <Ionicons name="person" size={20} color="#047857" />
                  </View>
                  <View>
                    <Text style={styles.delegateName}>{item.delegate_name}</Text>
                    <Text style={styles.delegatePhone}>{item.delegate_phone}</Text>
                  </View>
                </View>
                <View style={styles.amountContainer}>
                  <Text style={styles.amountValue}>{item.delegate_earnings.toLocaleString()}</Text>
                  <Text style={styles.amountCurrency}>FCFA</Text>
                </View>
              </View>

              <View style={styles.dotationDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="document-text" size={14} color="#6b7280" />
                  <Text style={styles.detailText}>{item.document_type} • {item.city}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar" size={14} color="#6b7280" />
                  <Text style={styles.detailText}>
                    Assigné le {new Date(item.assigned_at).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
              </View>

              {item.delegate_payment_status === 'paid' ? (
                <View style={styles.paidBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={styles.paidText}>
                    Payé le {new Date(item.delegate_paid_at!).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
              ) : (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.contactBtn}
                    onPress={() => handleContactDelegate(item.delegate_phone, item.delegate_name, item.delegate_earnings)}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                    <Text style={styles.contactBtnText}>Contacter</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.payBtn}
                    onPress={() => setSelectedDotation(item)}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.payBtnText}>Marquer payé</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal paiement */}
      {selectedDotation && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirmer le paiement</Text>
              <TouchableOpacity onPress={handleCloseModal}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalInfo}>
              <Text style={styles.modalLabel}>Délégué</Text>
              <Text style={styles.modalValue}>{selectedDotation.delegate_name}</Text>
              <Text style={styles.modalLabel}>Montant</Text>
              <Text style={styles.modalAmount}>
                {selectedDotation.delegate_earnings.toLocaleString()} FCFA
              </Text>
            </View>

            <Text style={styles.proofTitle}>Preuve de paiement (capture Wave)</Text>

            {proofImage ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: proofImage }} style={styles.previewImage} />
                <TouchableOpacity style={styles.removeBtn} onPress={() => setProofImage(null)}>
                  <Ionicons name="close-circle" size={28} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.uploadBtns}>
                <TouchableOpacity style={styles.uploadBtn} onPress={handleSelectProof}>
                  <Ionicons name="images" size={28} color="#047857" />
                  <Text style={styles.uploadBtnText}>Galerie</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.uploadBtn} onPress={handleTakePhoto}>
                  <Ionicons name="camera" size={28} color="#047857" />
                  <Text style={styles.uploadBtnText}>Photo</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.confirmBtn, (!proofImage || uploading) && styles.confirmBtnDisabled]}
              onPress={handleMarkAsPaid}
              disabled={!proofImage || uploading}
            >
              {uploading ? (
                <Text style={styles.confirmBtnText}>Envoi en cours...</Text>
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.confirmBtnText}>Confirmer le paiement</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 20,
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
  dotationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  dotationCardPaid: {
    borderLeftColor: '#10b981',
    opacity: 0.8,
  },
  dotationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  delegateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  delegateAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  delegateName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  delegatePhone: {
    fontSize: 13,
    color: '#6b7280',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#047857',
  },
  amountCurrency: {
    fontSize: 12,
    color: '#6b7280',
  },
  dotationDetails: {
    gap: 6,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#6b7280',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  paidText: {
    color: '#047857',
    fontWeight: '600',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dcfce7',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  contactBtnText: {
    color: '#25D366',
    fontWeight: '600',
  },
  payBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#047857',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  payBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalInfo: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  modalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  modalAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#047857',
  },
  proofTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  uploadBtns: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  uploadBtn: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#a7f3d0',
    borderStyle: 'dashed',
  },
  uploadBtnText: {
    color: '#047857',
    fontWeight: '600',
    marginTop: 6,
  },
  previewContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  removeBtn: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#fff',
    borderRadius: 14,
  },
  confirmBtn: {
    backgroundColor: '#047857',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmBtnDisabled: {
    backgroundColor: '#9ca3af',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
