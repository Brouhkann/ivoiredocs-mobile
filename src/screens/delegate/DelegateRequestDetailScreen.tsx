import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Image,
} from 'react-native';
import { Text, Divider } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { DOCUMENT_CONFIGS } from '../../utils/documents';

interface RequestInfo {
  id: string;
  document_type: string;
  service_type: string;
  status: string;
  city: string;
  copies: number;
  total_amount: number;
  delegate_earnings: number;
  form_data: any;
  created_at: string;
  users?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

interface Attachment {
  id: string;
  request_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
  file_url?: string;
}

export default function DelegateRequestDetailScreen({ route, navigation }: any) {
  const { requestId } = route.params;
  const { user } = useAuthStore();
  const [request, setRequest] = useState<RequestInfo | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (requestId && user) {
      fetchRequestData();
    }
  }, [requestId, user]);

  const fetchRequestData = async () => {
    try {
      setLoading(true);

      const { data: requestData, error: requestError } = await supabase
        .from('requests')
        .select(
          `
          *,
          users!requests_user_id_fkey (
            id,
            name,
            email,
            phone
          )
        `
        )
        .eq('id', requestId)
        .single();

      if (requestError) throw requestError;

      if (!requestData.users && requestData.user_id) {
        requestData.users = {
          id: requestData.user_id,
          name: 'Client',
          email: 'Non disponible',
          phone: 'Non disponible',
        };
      }

      setRequest(requestData);

      // Charger les pièces jointes
      const { data: attachmentsData, error: attachmentsError } = await supabase
        .from('request_attachments')
        .select('*')
        .eq('request_id', requestId);

      if (!attachmentsError && attachmentsData) {
        // Générer les URLs publiques
        const attachmentsWithUrls = attachmentsData.map((att) => {
          const baseUrl = supabase.storage.from('documents').getPublicUrl('dummy').data.publicUrl;
          const fileUrl = baseUrl.replace('/dummy', `/${att.storage_path}`);
          return { ...att, file_url: fileUrl };
        });
        setAttachments(attachmentsWithUrls);
      }
    } catch (error: any) {
      console.error('Erreur chargement demande:', error);
      toast.error('Impossible de charger les détails de la demande');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      setUpdatingStatus(true);

      const updateData: any = {
        status: newStatus,
      };

      const currentTime = new Date().toISOString();
      switch (newStatus) {
        case 'in_progress':
          updateData.started_at = currentTime;
          break;
        case 'ready':
          updateData.ready_at = currentTime;
          break;
        case 'shipped':
          updateData.shipped_at = currentTime;
          break;
        case 'delivered':
          updateData.delivered_at = currentTime;
          break;
        case 'completed':
          updateData.completed_at = currentTime;
          break;
      }

      const { error } = await supabase.from('requests').update(updateData).eq('id', requestId);

      if (error) throw error;

      toast.success('Statut mis à jour avec succès');
      await fetchRequestData();
    } catch (error: any) {
      console.error('Erreur mise à jour statut:', error);
      toast.error('Erreur lors de la mise à jour du statut');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCallClient = () => {
    if (request?.users?.phone && request.users.phone !== 'Non disponible') {
      Linking.openURL(`tel:${request.users.phone}`);
    } else {
      toast.error('Numéro de téléphone non disponible');
    }
  };

  const handleWhatsApp = () => {
    if (request?.users?.phone && request.users.phone !== 'Non disponible') {
      const phone = request.users.phone.replace(/\D/g, '');
      Linking.openURL(`whatsapp://send?phone=${phone}`);
    } else {
      toast.error('Numéro de téléphone non disponible');
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      new: 'Nouvelle',
      assigned: 'Assignée',
      in_progress: 'En cours',
      ready: 'Prête',
      shipped: 'Expédiée',
      delivered: 'Livrée',
      completed: 'Terminée',
      cancelled: 'Annulée',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned':
        return { bg: '#fef3c7', text: '#92400e' };
      case 'in_progress':
        return { bg: '#dbeafe', text: '#1e40af' };
      case 'ready':
        return { bg: '#d1fae5', text: '#065f46' };
      case 'shipped':
      case 'delivered':
      case 'completed':
        return { bg: '#dcfce7', text: '#166534' };
      default:
        return { bg: '#f3f4f6', text: '#374151' };
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatLabel = (key: string) => {
    const labels: { [key: string]: string } = {
      nom_complet: 'Nom complet',
      prenom: 'Prénom',
      nom: 'Nom de famille',
      date_naissance: 'Date de naissance',
      lieu_naissance: 'Lieu de naissance',
      nom_pere: 'Nom du père',
      nom_mere: 'Nom de la mère',
      profession: 'Profession',
      adresse: 'Adresse',
      telephone: 'Téléphone',
      email: 'Email',
      motif: 'Motif de la demande',
      numero_acte_mariage: "Numéro d'acte de mariage",
      numero_acte_naissance: "Numéro d'extrait d'acte de naissance",
      en_vue_mariage: 'En vue de mariage',
    };
    return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const calculateDelegateEarnings = () => {
    if (!request?.form_data?.billing_details) {
      return request?.delegate_earnings || 0;
    }

    const { documents, prestation, shipping } = request.form_data.billing_details;
    const documentsTotal = documents.reduce((sum: number, doc: any) => sum + doc.total_price, 0);
    const prestationMoitie = Math.round(prestation.amount / 2);
    const expeditionTotal = shipping ? shipping.amount : 0;

    return documentsTotal + prestationMoitie + expeditionTotal;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (!request) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Demande introuvable</Text>
      </View>
    );
  }

  const statusColor = getStatusColor(request.status);
  const documentConfig =
    DOCUMENT_CONFIGS[request.document_type as keyof typeof DOCUMENT_CONFIGS];

  const technicalFields = [
    'delivery_data',
    'uploaded_urls',
    'contact1',
    'moyen_expedition',
    'transport_classique',
    'nom_destinataire',
    'ville_destination',
    'moyen_recuperation',
    'moi_meme_gare',
    'en_vue_mariage',
    'billing_details',
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Traitement demande</Text>
          <Text style={styles.headerSubtitle}>#{request.id.slice(-8).toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Statut */}
        <View style={styles.statusCard}>
          <View style={styles.goldAccent} />
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusText, { color: statusColor.text }]}>
              {getStatusLabel(request.status)}
            </Text>
          </View>
        </View>

        {/* Détails du document */}
        <View style={styles.sectionCard}>
          <View style={styles.goldAccent} />
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={20} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Détails du document</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>TYPE DE DOCUMENT</Text>
            <Text style={styles.infoValue}>{documentConfig?.name || request.document_type}</Text>
            {request.document_type === 'extrait_acte_naissance' &&
              request.form_data?.en_vue_mariage === 'true' && (
                <Text style={styles.mariageBadge}>💍 En vue de mariage</Text>
              )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>SERVICE</Text>
            <Text style={styles.infoValue}>
              {request.service_type === 'mairie'
                ? 'Mairie'
                : request.service_type === 'sous_prefecture'
                ? 'Sous-préfecture'
                : 'Justice'}
            </Text>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoGridItem}>
              <Text style={styles.infoLabel}>COPIES</Text>
              <Text style={styles.infoValue}>
                {request.copies} exemplaire{request.copies > 1 ? 's' : ''}
              </Text>
            </View>

            <View style={styles.infoGridItem}>
              <Text style={styles.infoLabel}>DEMANDÉ LE</Text>
              <Text style={styles.infoValue}>
                {new Date(request.created_at).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>

          {/* Informations renseignées */}
          {request.form_data && Object.keys(request.form_data).length > 0 && (
            <View style={styles.formDataSection}>
              <View style={styles.formDataHeader}>
                <View style={styles.greenDot} />
                <Text style={styles.formDataTitle}>Informations renseignées</Text>
              </View>

              {Object.entries(request.form_data).map(([key, value]) => {
                if (
                  !value ||
                  value === '' ||
                  value === null ||
                  value === undefined ||
                  technicalFields.includes(key.toLowerCase())
                ) {
                  return null;
                }

                const isImportant =
                  key.toLowerCase().includes('numero_acte') || key.toLowerCase().includes('numero');

                return (
                  <View
                    key={key}
                    style={[styles.formDataItem, isImportant && styles.formDataItemImportant]}
                  >
                    {isImportant && <Text style={styles.importantStar}>⭐</Text>}
                    <View style={styles.formDataContent}>
                      <Text
                        style={[
                          styles.formDataLabel,
                          isImportant && styles.formDataLabelImportant,
                        ]}
                      >
                        {formatLabel(key)}
                      </Text>
                      <Text
                        style={[
                          styles.formDataValue,
                          isImportant && styles.formDataValueImportant,
                        ]}
                      >
                        {String(value)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Pièces jointes */}
        <View style={styles.sectionCard}>
          <View style={styles.goldAccent} />
          <View style={styles.sectionHeader}>
            <Ionicons name="images" size={20} color="#3b82f6" />
            <Text style={[styles.sectionTitle, { color: '#3b82f6' }]}>
              Pièces jointes ({attachments.length})
            </Text>
          </View>

          {attachments.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyStateText}>Aucune pièce jointe</Text>
            </View>
          ) : (
            <View style={styles.attachmentsList}>
              {attachments.map((attachment) => {
                const isImage = attachment.file_type.startsWith('image/');
                return (
                  <TouchableOpacity
                    key={attachment.id}
                    style={styles.attachmentCard}
                    onPress={() => {
                      if (attachment.file_url) {
                        Linking.openURL(attachment.file_url);
                      }
                    }}
                  >
                    <View style={styles.attachmentBadge}>
                      <Text style={styles.attachmentBadgeText}>
                        {isImage ? '🖼️ IMAGE' : '📄 DOC'}
                      </Text>
                    </View>

                    {isImage && attachment.file_url ? (
                      <Image
                        source={{ uri: attachment.file_url }}
                        style={styles.attachmentImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.attachmentIconContainer}>
                        <Ionicons name="document" size={32} color="#3b82f6" />
                      </View>
                    )}

                    <View style={styles.attachmentInfo}>
                      <Text style={styles.attachmentName} numberOfLines={1}>
                        {attachment.file_name}
                      </Text>
                      <Text style={styles.attachmentSize}>{formatFileSize(attachment.file_size)}</Text>
                      <Text style={styles.attachmentDate}>
                        {new Date(attachment.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Informations de livraison */}
        {request.form_data?.delivery_data && (
          <View style={styles.sectionCard}>
            <View style={styles.goldAccent} />
            <View style={styles.sectionHeader}>
              <Ionicons name="location" size={20} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Informations de livraison</Text>
            </View>

            {request.form_data.delivery_data.moyen_recuperation && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>MODE DE RÉCUPÉRATION</Text>
                <Text style={styles.infoValue}>
                  {request.form_data.delivery_data.moyen_recuperation === 'moi_meme_gare'
                    ? 'Récupération à la gare'
                    : request.form_data.delivery_data.moyen_recuperation === 'livraison_express'
                    ? 'Livraison express'
                    : 'Autre'}
                </Text>
              </View>
            )}

            {request.form_data.delivery_data.ville_destination && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>VILLE DE DESTINATION</Text>
                <Text style={styles.infoValue}>
                  {request.form_data.delivery_data.ville_destination}
                </Text>
              </View>
            )}

            {request.form_data.delivery_data.nom_destinataire && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>NOM DU DESTINATAIRE</Text>
                <Text style={styles.infoValue}>
                  {request.form_data.delivery_data.nom_destinataire}
                </Text>
              </View>
            )}

            {request.form_data.delivery_data.contact1 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>CONTACT</Text>
                <Text style={styles.infoValue}>{request.form_data.delivery_data.contact1}</Text>
              </View>
            )}
          </View>
        )}

        {/* Résumé financier détaillé */}
        <View style={styles.sectionCard}>
          <View style={styles.goldAccent} />
          <View style={styles.sectionHeader}>
            <Ionicons name="receipt" size={20} color="#10b981" />
            <Text style={[styles.sectionTitle, { color: '#10b981' }]}>Résumé financier</Text>
          </View>

          {request.form_data?.billing_details ? (
            <View style={styles.billingDetails}>
              {/* Documents */}
              <Text style={styles.billingCategory}>📄 Documents commandés</Text>
              {request.form_data.billing_details.documents.map((doc: any, index: number) => (
                <View key={index} style={styles.billingItem}>
                  <View style={styles.billingItemLeft}>
                    <Text style={styles.billingItemName}>{doc.document_name}</Text>
                    <Text style={styles.billingItemDesc}>
                      {doc.copies} copie{doc.copies > 1 ? 's' : ''} × {doc.unit_price.toLocaleString()}{' '}
                      FCFA
                    </Text>
                  </View>
                  <Text style={styles.billingItemPrice}>{doc.total_price.toLocaleString()} FCFA</Text>
                </View>
              ))}

              {/* Prestation */}
              <View style={[styles.billingItem, { backgroundColor: '#dbeafe' }]}>
                <View style={styles.billingItemLeft}>
                  <Text style={styles.billingItemName}>💼 Prestation délégué</Text>
                  <Text style={styles.billingItemDesc}>Frais de service délégué</Text>
                </View>
                <Text style={styles.billingItemPrice}>
                  {request.form_data.billing_details.prestation.amount.toLocaleString()} FCFA
                </Text>
              </View>

              {/* Expédition */}
              {request.form_data.billing_details.shipping && (
                <View style={[styles.billingItem, { backgroundColor: '#fed7aa' }]}>
                  <View style={styles.billingItemLeft}>
                    <Text style={styles.billingItemName}>🚚 Expédition</Text>
                    <Text style={styles.billingItemDesc}>
                      {request.form_data.billing_details.shipping.description}
                    </Text>
                  </View>
                  <Text style={styles.billingItemPrice}>
                    {request.form_data.billing_details.shipping.amount.toLocaleString()} FCFA
                  </Text>
                </View>
              )}

              <Divider style={styles.billingDivider} />

              {/* Total client */}
              <View style={styles.billingTotal}>
                <Text style={styles.billingTotalLabel}>💰 TOTAL PAYÉ (Client)</Text>
                <Text style={styles.billingTotalAmount}>
                  {request.form_data.billing_details.total_amount.toLocaleString()} FCFA
                </Text>
              </View>

              {/* Dotation délégué */}
              <View style={styles.delegateEarningsCard}>
                <Text style={styles.delegateEarningsLabel}>💰 Dotation du délégué</Text>
                <Text style={styles.delegateEarningsDesc}>
                  Documents + 50% prestation + expédition
                </Text>
                <Text style={styles.delegateEarningsAmount}>
                  {calculateDelegateEarnings().toLocaleString()} FCFA
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.simpleBilling}>
              <View style={styles.billingTotal}>
                <Text style={styles.billingTotalLabel}>💰 Total de la commande</Text>
                <Text style={styles.billingTotalAmount}>
                  {request.total_amount?.toLocaleString() || 0} FCFA
                </Text>
              </View>

              <View style={styles.delegateEarningsCard}>
                <Text style={styles.delegateEarningsLabel}>💰 Dotation du délégué</Text>
                <Text style={styles.delegateEarningsDesc}>Rémunération délégué</Text>
                <Text style={styles.delegateEarningsAmount}>
                  {request.delegate_earnings?.toLocaleString() || 0} FCFA
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Informations client */}
        <View style={styles.sectionCard}>
          <View style={styles.goldAccent} />
          <View style={styles.sectionHeader}>
            <Ionicons name="person" size={20} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Informations client</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>NOM</Text>
            <Text style={styles.infoValue}>{request.users?.name || 'Non disponible'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>EMAIL</Text>
            <Text style={styles.infoValue}>{request.users?.email || 'Non disponible'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>TÉLÉPHONE</Text>
            <Text style={styles.infoValue}>{request.users?.phone || 'Non disponible'}</Text>
          </View>

          {/* Boutons de contact */}
          <View style={styles.contactButtons}>
            <TouchableOpacity style={styles.contactButton} onPress={handleCallClient}>
              <Ionicons name="call" size={20} color="#ffffff" />
              <Text style={styles.contactButtonText}>Appeler</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.whatsappButton} onPress={handleWhatsApp}>
              <Ionicons name="logo-whatsapp" size={20} color="#ffffff" />
              <Text style={styles.contactButtonText}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Actions */}
        {request.status === 'assigned' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#3b82f6' }]}
            onPress={() => handleUpdateStatus('in_progress')}
            disabled={updatingStatus}
          >
            <Ionicons name="play-circle" size={24} color="#ffffff" />
            <Text style={styles.actionButtonText}>Commencer la mission</Text>
          </TouchableOpacity>
        )}

        {request.status === 'in_progress' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#10b981' }]}
            onPress={() => handleUpdateStatus('ready')}
            disabled={updatingStatus}
          >
            <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
            <Text style={styles.actionButtonText}>Documents prêts</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fef3c7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#92400e',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
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
  },
  headerContent: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    marginTop: 3,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  statusCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.08)',
    overflow: 'hidden',
  },
  goldAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: '#d4af37',
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
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
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f59e0b',
    marginLeft: 10,
  },
  infoRow: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  mariageBadge: {
    fontSize: 14,
    color: '#db2777',
    fontWeight: '700',
    marginTop: 6,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  infoGridItem: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 12,
  },
  formDataSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  formDataHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 8,
  },
  formDataTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  formDataItem: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  formDataItemImportant: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  importantStar: {
    fontSize: 16,
    marginRight: 8,
  },
  formDataContent: {
    flex: 1,
  },
  formDataLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  formDataLabelImportant: {
    color: '#92400e',
  },
  formDataValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  formDataValueImportant: {
    color: '#78350f',
  },
  attachmentsList: {
    gap: 12,
  },
  attachmentCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 2,
    borderColor: '#dbeafe',
    elevation: 2,
  },
  attachmentBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 1,
  },
  attachmentBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  attachmentImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    marginBottom: 12,
  },
  attachmentIconContainer: {
    width: '100%',
    height: 150,
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  attachmentInfo: {
    gap: 4,
  },
  attachmentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e40af',
  },
  attachmentSize: {
    fontSize: 13,
    color: '#3b82f6',
  },
  attachmentDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
  },
  billingDetails: {
    gap: 12,
  },
  billingCategory: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
    marginTop: 8,
    marginBottom: 4,
  },
  billingItem: {
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  billingItemLeft: {
    flex: 1,
  },
  billingItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  billingItemDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  billingItemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
  },
  billingDivider: {
    backgroundColor: '#10b981',
    height: 2,
    marginVertical: 8,
  },
  billingTotal: {
    backgroundColor: '#d1fae5',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6ee7b7',
  },
  billingTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065f46',
  },
  billingTotalAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#047857',
  },
  delegateEarningsCard: {
    backgroundColor: '#dcfce7',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#86efac',
    marginTop: 8,
  },
  delegateEarningsLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#166534',
  },
  delegateEarningsDesc: {
    fontSize: 12,
    color: '#15803d',
    marginTop: 4,
  },
  delegateEarningsAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: '#16a34a',
    marginTop: 8,
  },
  simpleBilling: {
    gap: 12,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    elevation: 3,
  },
  whatsappButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    elevation: 3,
  },
  contactButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 12,
    elevation: 6,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
});
