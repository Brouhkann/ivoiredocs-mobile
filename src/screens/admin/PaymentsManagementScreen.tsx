import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { toast } from '../../stores/toastStore';
import { supabase } from '../../config/supabase';
import {
  getPendingInvoices,
  confirmPayment,
  rejectPayment,
  type Invoice,
} from '../../services/wavePaymentService';
import Loading from '../../components/ui/Loading';

const { width: screenWidth } = Dimensions.get('window');

export default function PaymentsManagementScreen({ navigation }: any) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [proofImageUrl, setProofImageUrl] = useState<string | null>(null);
  const [showProofModal, setShowProofModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  const loadInvoices = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const data = await getPendingInvoices();
      setInvoices(data);
    } catch (error) {
      console.error('Erreur chargement factures:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadInvoices();
    }, [])
  );

  // Voir la preuve de paiement
  const handleViewProof = async (invoice: Invoice) => {
    if (!invoice.payment_proof_url) {
      toast.error('Aucune preuve de paiement');
      return;
    }

    try {
      setSelectedInvoice(invoice);

      // Générer une URL signée pour l'image
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(invoice.payment_proof_url, 3600);

      if (data?.signedUrl) {
        setProofImageUrl(data.signedUrl);
      } else {
        setProofImageUrl(invoice.payment_proof_url);
      }

      setShowProofModal(true);
    } catch (error) {
      console.error('Erreur chargement preuve:', error);
      toast.error('Erreur lors du chargement de la preuve');
    }
  };

  // Confirmer le paiement
  const handleConfirmPayment = async (invoice: Invoice) => {
    Alert.alert(
      'Confirmer le paiement',
      `Confirmez-vous avoir reçu le paiement de ${invoice.amount.toLocaleString()} FCFA pour la facture ${invoice.reference} ?`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, confirmer',
          style: 'default',
          onPress: async () => {
            setProcessing(true);
            try {
              const result = await confirmPayment(invoice.id);

              if (!result.success) {
                throw new Error(result.error || 'Erreur lors de la confirmation');
              }

              toast.success('Paiement confirmé ! Demande créée et assignée.');
              setShowProofModal(false);
              loadInvoices();
            } catch (error: any) {
              console.error('Erreur confirmation:', error);
              toast.error(error.message || 'Erreur lors de la confirmation');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  // Rejeter le paiement
  const handleRejectPayment = async (invoice: Invoice) => {
    Alert.alert(
      'Rejeter le paiement',
      `Êtes-vous sûr de vouloir rejeter ce paiement ? Le client sera notifié.`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, rejeter',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              const result = await rejectPayment(invoice.id, 'Preuve de paiement invalide');

              if (!result.success) {
                throw new Error(result.error || 'Erreur lors du rejet');
              }

              toast.success('Paiement rejeté');
              setShowProofModal(false);
              loadInvoices();
            } catch (error: any) {
              console.error('Erreur rejet:', error);
              toast.error(error.message || 'Erreur lors du rejet');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  // Formater la date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <Loading message="Chargement des paiements..." />;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Paiements à valider</Text>
          <Text style={styles.headerSubtitle}>
            {invoices.length} paiement(s) en attente de validation
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadInvoices(true)}
            colors={['#047857']}
          />
        }
      >
        {invoices.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={64} color="#10b981" />
            <Text style={styles.emptyTitle}>Aucun paiement en attente</Text>
            <Text style={styles.emptySubtitle}>
              Les paiements avec preuve apparaîtront ici
            </Text>
          </View>
        ) : (
          invoices.map((invoice) => (
            <TouchableOpacity
              key={invoice.id}
              style={styles.invoiceCard}
              onPress={() => handleViewProof(invoice)}
              activeOpacity={0.7}
            >
              {/* Badge preuve */}
              <View style={styles.proofBadge}>
                <Ionicons name="document-attach" size={14} color="#047857" />
                <Text style={styles.proofBadgeText}>Preuve reçue</Text>
              </View>

              {/* En-tête */}
              <View style={styles.invoiceHeader}>
                <View style={styles.invoiceInfo}>
                  <Text style={styles.invoiceReference}>{invoice.reference}</Text>
                  <Text style={styles.invoiceDate}>{formatDate(invoice.created_at)}</Text>
                </View>
                <View style={styles.amountContainer}>
                  <Text style={styles.invoiceAmount}>
                    {invoice.amount.toLocaleString()}
                  </Text>
                  <Text style={styles.invoiceCurrency}>FCFA</Text>
                </View>
              </View>

              {/* Détails de la demande */}
              <View style={styles.invoiceDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="document-text" size={16} color="#6b7280" />
                  <Text style={styles.detailText}>{invoice.metadata.document_type}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="location" size={16} color="#6b7280" />
                  <Text style={styles.detailText}>{invoice.metadata.city}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="copy" size={16} color="#6b7280" />
                  <Text style={styles.detailText}>{invoice.metadata.copies} copie(s)</Text>
                </View>
              </View>

              {/* Client */}
              <View style={styles.clientSection}>
                <View style={styles.detailRow}>
                  <Ionicons name="person" size={16} color="#047857" />
                  <Text style={styles.clientName}>{invoice.metadata.customer_name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="call" size={16} color="#047857" />
                  <Text style={styles.clientPhone}>{invoice.metadata.customer_phone}</Text>
                </View>
              </View>

              {/* Appel à l'action */}
              <View style={styles.cardFooter}>
                <Text style={styles.tapToView}>Appuyez pour voir la preuve</Text>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal de visualisation de la preuve */}
      <Modal
        visible={showProofModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProofModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header modal */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Preuve de paiement</Text>
                <Text style={styles.modalSubtitle}>{selectedInvoice?.reference}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowProofModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Détails facture */}
            {selectedInvoice && (
              <View style={styles.modalInvoiceInfo}>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Document:</Text>
                  <Text style={styles.modalInfoValue}>{selectedInvoice.metadata.document_type}</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Ville:</Text>
                  <Text style={styles.modalInfoValue}>{selectedInvoice.metadata.city}</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Montant:</Text>
                  <Text style={styles.modalInfoValueBold}>
                    {selectedInvoice.amount.toLocaleString()} FCFA
                  </Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Client:</Text>
                  <Text style={styles.modalInfoValue}>{selectedInvoice.metadata.customer_name}</Text>
                </View>
              </View>
            )}

            {/* Image de la preuve */}
            <View style={styles.proofImageContainer}>
              {proofImageUrl ? (
                <Image
                  source={{ uri: proofImageUrl }}
                  style={styles.proofImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.noProofPlaceholder}>
                  <Ionicons name="image-outline" size={48} color="#d1d5db" />
                  <Text style={styles.noProofText}>Chargement...</Text>
                </View>
              )}
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.rejectButton, processing && styles.buttonDisabled]}
                onPress={() => selectedInvoice && handleRejectPayment(selectedInvoice)}
                disabled={processing}
              >
                <Ionicons name="close-circle" size={20} color="#dc2626" />
                <Text style={styles.rejectButtonText}>Rejeter</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, processing && styles.buttonDisabled]}
                onPress={() => selectedInvoice && handleConfirmPayment(selectedInvoice)}
                disabled={processing}
              >
                <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                <Text style={styles.confirmButtonText}>
                  {processing ? 'Traitement...' : 'Confirmer le paiement'}
                </Text>
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
  header: {
    backgroundColor: '#047857',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  invoiceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  proofBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
    gap: 4,
  },
  proofBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceReference: {
    fontSize: 16,
    fontWeight: '800',
    color: '#047857',
  },
  invoiceDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
  },
  invoiceCurrency: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  invoiceDetails: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  clientSection: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
    gap: 6,
  },
  clientName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  clientPhone: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 4,
  },
  tapToView: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#047857',
    fontWeight: '600',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  modalInvoiceInfo: {
    padding: 16,
    backgroundColor: '#f9fafb',
    gap: 8,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalInfoLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  modalInfoValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  modalInfoValueBold: {
    fontSize: 14,
    color: '#047857',
    fontWeight: '800',
  },
  proofImageContainer: {
    backgroundColor: '#f3f4f6',
    minHeight: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  proofImage: {
    width: screenWidth - 32,
    height: 350,
  },
  noProofPlaceholder: {
    alignItems: 'center',
    padding: 40,
  },
  noProofText: {
    color: '#9ca3af',
    marginTop: 8,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#dc2626',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#047857',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
