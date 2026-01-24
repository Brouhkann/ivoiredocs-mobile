import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Text, Badge } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { toast } from '../../stores/toastStore';
import {
  getPendingInvoices,
  confirmPayment,
  cancelInvoice,
  openWhatsAppToClient,
  type Invoice,
} from '../../services/wavePaymentService';

export default function PaymentsManagementScreen({ navigation }: any) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [waveLink, setWaveLink] = useState('');
  const [waveTransactionId, setWaveTransactionId] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadInvoices = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const data = await getPendingInvoices();
      setInvoices(data);
    } catch (error) {
      console.error('Erreur chargement factures:', error);
      toast.error('Erreur lors du chargement des factures');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Envoyer le lien Wave au client via WhatsApp
  const handleSendWaveLink = (invoice: Invoice) => {
    if (!waveLink.trim()) {
      toast.error('Veuillez entrer le lien Wave');
      return;
    }
    openWhatsAppToClient(invoice.metadata.customer_phone, invoice, waveLink);
    toast.success('WhatsApp ouvert');
  };

  // Ouvrir le modal de confirmation de paiement
  const handleOpenConfirmModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setWaveTransactionId('');
    setShowConfirmModal(true);
  };

  // Confirmer le paiement
  const handleConfirmPayment = async () => {
    if (!selectedInvoice) return;

    setProcessing(true);
    try {
      const result = await confirmPayment(selectedInvoice.id, waveTransactionId || undefined);

      if (!result.success) {
        throw new Error(result.error || 'Erreur lors de la confirmation');
      }

      toast.success('Paiement confirmé ! Demande créée.');
      setShowConfirmModal(false);
      setSelectedInvoice(null);
      loadInvoices();
    } catch (error: any) {
      console.error('Erreur confirmation:', error);
      toast.error(error.message || 'Erreur lors de la confirmation');
    } finally {
      setProcessing(false);
    }
  };

  // Annuler une facture
  const handleCancelInvoice = (invoice: Invoice) => {
    Alert.alert(
      'Annuler la facture',
      `Êtes-vous sûr de vouloir annuler la facture ${invoice.reference} ?`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            const success = await cancelInvoice(invoice.id);
            if (success) {
              toast.success('Facture annulée');
              loadInvoices();
            } else {
              toast.error('Erreur lors de l\'annulation');
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculer le temps restant avant expiration
  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date().getTime();
    const expires = new Date(expiresAt).getTime();
    const diff = expires - now;

    if (diff <= 0) return 'Expirée';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h ${minutes}min`;
    return `${minutes} min`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Paiements Wave</Text>
          <Text style={styles.headerSubtitle}>{invoices.length} facture(s) en attente</Text>
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
            <Text style={styles.emptyTitle}>Aucune facture en attente</Text>
            <Text style={styles.emptySubtitle}>
              Toutes les factures ont été traitées
            </Text>
          </View>
        ) : (
          invoices.map((invoice) => (
            <View key={invoice.id} style={styles.invoiceCard}>
              {/* En-tête de la facture */}
              <View style={styles.invoiceHeader}>
                <View>
                  <Text style={styles.invoiceReference}>{invoice.reference}</Text>
                  <Text style={styles.invoiceDate}>{formatDate(invoice.created_at)}</Text>
                </View>
                <View style={styles.invoiceAmountContainer}>
                  <Text style={styles.invoiceAmount}>
                    {invoice.amount.toLocaleString()} FCFA
                  </Text>
                  <Text style={styles.invoiceExpires}>
                    Expire dans {getTimeRemaining(invoice.expires_at)}
                  </Text>
                </View>
              </View>

              {/* Détails client */}
              <View style={styles.invoiceDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="person" size={16} color="#6b7280" />
                  <Text style={styles.detailText}>{invoice.metadata.customer_name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="call" size={16} color="#6b7280" />
                  <Text style={styles.detailText}>{invoice.metadata.customer_phone}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="document-text" size={16} color="#6b7280" />
                  <Text style={styles.detailText}>
                    {invoice.metadata.document_type} - {invoice.metadata.city}
                  </Text>
                </View>
              </View>

              {/* Zone lien Wave */}
              <View style={styles.waveLinkSection}>
                <Text style={styles.waveLinkLabel}>Lien Wave à envoyer:</Text>
                <TextInput
                  style={styles.waveLinkInput}
                  placeholder="Collez le lien Wave ici..."
                  value={selectedInvoice?.id === invoice.id ? waveLink : ''}
                  onChangeText={(text) => {
                    setSelectedInvoice(invoice);
                    setWaveLink(text);
                  }}
                  onFocus={() => setSelectedInvoice(invoice)}
                />
                <TouchableOpacity
                  style={styles.sendWhatsAppButton}
                  onPress={() => {
                    setSelectedInvoice(invoice);
                    handleSendWaveLink(invoice);
                  }}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#ffffff" />
                  <Text style={styles.sendWhatsAppText}>Envoyer au client</Text>
                </TouchableOpacity>
              </View>

              {/* Actions */}
              <View style={styles.invoiceActions}>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={() => handleOpenConfirmModal(invoice)}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                  <Text style={styles.confirmButtonText}>Confirmer paiement</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => handleCancelInvoice(invoice)}
                >
                  <Ionicons name="close-circle" size={18} color="#dc2626" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal de confirmation */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirmer le paiement</Text>
            <Text style={styles.modalSubtitle}>
              Facture: {selectedInvoice?.reference}
            </Text>
            <Text style={styles.modalAmount}>
              {selectedInvoice?.amount.toLocaleString()} FCFA
            </Text>

            <Text style={styles.inputLabel}>ID Transaction Wave (optionnel)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: TXN123456789"
              value={waveTransactionId}
              onChangeText={setWaveTransactionId}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowConfirmModal(false)}
                disabled={processing}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmButton, processing && styles.buttonDisabled]}
                onPress={handleConfirmPayment}
                disabled={processing}
              >
                <Text style={styles.modalConfirmText}>
                  {processing ? 'Traitement...' : 'Confirmer'}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#047857',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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
  invoiceAmountContainer: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  invoiceExpires: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '600',
    marginTop: 2,
  },
  invoiceDetails: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 8,
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
  waveLinkSection: {
    backgroundColor: '#e0f2fe',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  waveLinkLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
    marginBottom: 8,
  },
  waveLinkInput: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#7dd3fc',
    marginBottom: 10,
  },
  sendWhatsAppButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  sendWhatsAppText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  invoiceActions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#047857',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  cancelButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#047857',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  modalConfirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#047857',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
