import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import ImageView from 'react-native-image-viewing';
import Loading from '../../components/ui/Loading';
import Badge from '../../components/ui/Badge';
import RequestTimeline from '../../components/request/RequestTimeline';
import { getRequest } from '../../services/requestService';
import { DOCUMENT_CONFIGS } from '../../utils/documents';
import type { Request } from '../../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function RequestDetailScreen({ route, navigation }: any) {
  const { requestId } = route.params;
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewingImage, setViewingImage] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    loadRequest();
  }, [requestId]);

  const loadRequest = async () => {
    try {
      const data = await getRequest(requestId);
      console.log('Request data:', JSON.stringify(data, null, 2));
      console.log('Form data:', data?.form_data);
      console.log('Attachments:', data?.attachments);
      console.log('Prices:', {
        document_price: data?.document_price,
        service_price: data?.service_price,
        shipping_price: data?.shipping_price,
        delivery_price: data?.delivery_price,
      });
      setRequest(data);
    } catch (error) {
      console.error('Erreur chargement demande:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading message="Chargement des détails..." />;
  }

  if (!request) {
    return (
      <View style={styles.container}>
        {/* Header personnalisé */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Détails de la demande</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#d1d5db" />
          <Text style={styles.errorText}>Demande introuvable</Text>
        </View>
      </View>
    );
  }

  const documentConfig = DOCUMENT_CONFIGS[request.document_type];
  const formattedDate = format(new Date(request.created_at), 'd MMMM yyyy', { locale: fr });

  // Fonction pour extraire le nom de la personne concernée
  const getPersonName = (): string => {
    if (!request.form_data) return '';

    if (request.document_type === 'declaration_naissance') {
      const nom = request.form_data.nom_enfant || '';
      const prenoms = request.form_data.prenoms_enfant || '';
      return nom && prenoms ? `${nom} ${prenoms}` : nom || prenoms;
    }

    if (['extrait_acte_naissance', 'copie_integrale_naissance',
         'certificat_celibat', 'certificat_non_divorce', 'certificat_residence'].includes(request.document_type)) {
      return request.form_data.nom_complet || '';
    }

    if (['extrait_acte_mariage', 'copie_integrale_mariage'].includes(request.document_type)) {
      const epoux = request.form_data.nom_epoux || '';
      const epouse = request.form_data.nom_epouse || '';
      return epoux && epouse ? `${epoux} & ${epouse}` : epoux || epouse;
    }

    return request.form_data.full_name || '';
  };

  const personName = getPersonName();
  const isForMarriage = request.document_type === 'extrait_acte_naissance' &&
                        request.form_data?.en_vue_mariage === 'true';

  // Fonction pour extraire le numéro d'acte
  const getNumeroActe = (): string | null => {
    if (!request.form_data) return null;
    // Essayer différentes variantes de noms de champs
    const numero = request.form_data.numero_acte ||
                   request.form_data.numeroActe ||
                   request.form_data.numero_acte_naissance ||
                   request.form_data.numero_acte_mariage ||
                   request.form_data.numero ||
                   request.form_data.act_number ||
                   null;
    console.log('Numéro d\'acte trouvé:', numero);
    console.log('form_data complet:', request.form_data);
    return numero;
  };

  const numeroActe = getNumeroActe();

  // Fonction pour télécharger une pièce jointe
  const downloadAttachment = async (url: string, filename: string) => {
    if (!url || !filename) {
      Alert.alert('Erreur', 'Fichier introuvable');
      return;
    }

    try {
      const fileUri = FileSystem.documentDirectory + filename;
      const downloadResult = await FileSystem.downloadAsync(url, fileUri);

      if (downloadResult.status === 200) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(downloadResult.uri);
        } else {
          Alert.alert('Succès', 'Fichier téléchargé avec succès');
        }
      } else {
        Alert.alert('Erreur', 'Échec du téléchargement');
      }
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      Alert.alert('Erreur', 'Impossible de télécharger le fichier');
    }
  };

  // Fonction pour voir une pièce jointe
  const viewAttachment = async (url: string, fileName: string, fileType: string) => {
    console.log('👁️ viewAttachment appelé:', { url, fileName, fileType });

    if (!url) {
      Alert.alert('Erreur', 'URL du fichier introuvable');
      return;
    }

    try {
      // Si c'est une image, ouvrir dans le viewer intégré
      if (fileType && fileType.includes('image')) {
        console.log('🖼️ Ouverture viewer d\'image pour:', fileName);
        setViewingImage({ url, name: fileName });
        setImageViewerVisible(true);
      } else {
        // Pour PDF et autres fichiers, ouvrir dans le navigateur/viewer externe
        console.log('📄 Ouverture dans navigateur pour:', fileName);
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          Alert.alert('Erreur', 'Impossible d\'ouvrir ce type de fichier');
        }
      }
    } catch (error) {
      console.error('❌ Erreur ouverture:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir le fichier');
    }
  };

  // Récapitulatif de paiement - utiliser billing_details (données figées)
  let documentLabel: string;
  let documentPrice: number;
  let serviceLabel: string;
  let servicePrice: number;
  let shippingLabel: string;
  let shippingPrice: number;
  let totalAmount: number;

  if (request.form_data?.billing_details) {
    // PRIORITÉ 1: Utiliser les détails de facturation figés depuis form_data
    // Ces données ne changent JAMAIS même si les prix des documents sont modifiés
    const billing = request.form_data.billing_details;

    // Prix des documents (depuis billing_details.documents)
    if (billing.documents && billing.documents.length > 0) {
      const doc = billing.documents[0]; // Premier document
      documentLabel = `${doc.document_name} (${doc.copies} ${doc.copies > 1 ? 'copies' : 'copie'})`;
      documentPrice = doc.total_price || billing.payment_breakdown?.documents_subtotal || 0;
    } else {
      documentLabel = `${documentConfig.name} (${request.copies} ${request.copies > 1 ? 'copies' : 'copie'})`;
      documentPrice = billing.payment_breakdown?.documents_subtotal || 0;
    }

    // Prestation (figée)
    serviceLabel = billing.prestation?.description || 'Prestation';
    servicePrice = billing.prestation?.amount || billing.payment_breakdown?.prestation_fee || 0;

    // Expédition (figée)
    shippingLabel = billing.shipping?.description || 'Expédition';
    shippingPrice = billing.shipping?.amount || billing.payment_breakdown?.shipping_fee || 0;

    // Total (figé)
    totalAmount = billing.total_amount || request.total_amount;

    console.log('✅ Utilisation des données FIGÉES de billing_details:', {
      document: documentPrice,
      service: servicePrice,
      shipping: shippingPrice,
      total: totalAmount
    });
  } else if (request.document_price && request.document_price > 0) {
    // PRIORITÉ 2: Utiliser les prix de la base de données
    documentLabel = `${documentConfig.name} (${request.copies} ${request.copies > 1 ? 'copies' : 'copie'})`;
    documentPrice = request.document_price * request.copies;
    serviceLabel = 'Prestation';
    servicePrice = request.service_price || 0;
    shippingLabel = request.shipping_company ? `Expédition par ${request.shipping_company}` : 'Expédition';
    shippingPrice = request.shipping_price || 0;
    totalAmount = request.total_amount;

    console.log('⚠️ Utilisation des prix de la base de données (non figés)');
  } else {
    // PRIORITÉ 3: Calculer les prix (fallback)
    documentLabel = `${documentConfig.name} (${request.copies} ${request.copies > 1 ? 'copies' : 'copie'})`;
    documentPrice = documentConfig.base_price * request.copies;
    serviceLabel = 'Prestation';
    const remaining = request.total_amount - documentPrice;

    if (request.shipping_company || request.status === 'shipped' || request.status === 'delivered') {
      servicePrice = Math.round(remaining * 0.6);
      shippingPrice = remaining - servicePrice;
    } else {
      servicePrice = remaining;
      shippingPrice = 0;
    }

    shippingLabel = request.shipping_company ? `Expédition par ${request.shipping_company}` : 'Expédition';
    totalAmount = request.total_amount;

    console.log('⚠️ Calcul des prix (pas de données figées)');
  }

  return (
    <View style={styles.container}>
      {/* Header personnalisé */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails de la demande</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Carte Statut et Document */}
        <View style={styles.statusCard}>
          <View style={styles.goldAccent} />

          <View style={styles.statusHeader}>
            <Badge status={request.status} label="" />
            <Text style={styles.dateText}>{formattedDate}</Text>
          </View>

          <View style={styles.documentSection}>
            <View style={styles.documentIconCircle}>
              <Ionicons name="document-text" size={24} color="#d4af37" />
            </View>
            <Text style={styles.documentTitle}>{documentConfig.name}</Text>
          </View>

          {personName && (
            <View style={styles.personCard}>
              <Ionicons name="person" size={16} color="#d4af37" />
              <Text style={styles.personName}>{personName}</Text>
            </View>
          )}

          {isForMarriage && (
            <View style={styles.marriageTag}>
              <Text style={styles.marriageText}>💍 En vue de mariage</Text>
            </View>
          )}
        </View>

        {/* Informations du Document */}
        <SectionCard title="Informations du document" icon="document-text">
          <InfoRow icon="business" label="Service administratif" value={request.service_type === 'mairie' ? 'Mairie' : 'Sous-Préfecture'} />
          <InfoRow icon="location" label="Ville" value={request.city} />
          {numeroActe && (
            <InfoRow icon="qr-code" label="Numéro d'acte" value={numeroActe} />
          )}
        </SectionCard>

        {/* Récapitulatif de paiement */}
        <SectionCard title="Récapitulatif de paiement" icon="receipt">
          <View style={styles.paymentSummary}>
            {/* Prix des documents - toujours affiché */}
            <PaymentLine
              label={documentLabel}
              amount={documentPrice}
            />

            {/* Prix de la prestation - toujours affiché si > 0 */}
            {servicePrice > 0 && (
              <PaymentLine label={serviceLabel} amount={servicePrice} />
            )}

            {/* Prix de l'expédition - affiché si > 0 */}
            {shippingPrice > 0 && (
              <PaymentLine
                label={shippingLabel}
                amount={shippingPrice}
              />
            )}

            {/* Total - utilise le total figé */}
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Total payé</Text>
              <Text style={styles.totalAmount}>{totalAmount.toLocaleString()} FCFA</Text>
            </View>
          </View>
        </SectionCard>

        {/* Pièces jointes */}
        {request.attachments && request.attachments.length > 0 && (
          <SectionCard title={`Pièces jointes (${request.attachments.length})`} icon="attach">
            {request.attachments.map((attachment: any, index: number) => {
              console.log('Rendering attachment:', {
                name: attachment.file_name,
                url: attachment.file_url,
                storage_path: attachment.storage_path
              });
              return (
                <AttachmentCard
                  key={attachment.id || index}
                  attachment={attachment}
                  onView={() => viewAttachment(attachment.file_url, attachment.file_name, attachment.file_type)}
                  onDownload={() => downloadAttachment(attachment.file_url, attachment.file_name)}
                />
              );
            })}
          </SectionCard>
        )}

        {/* Suivi de la demande */}
        <SectionCard title="Suivi de la demande">
          <RequestTimeline request={request} />
        </SectionCard>

        {/* Informations de livraison */}
        {(request.status === 'shipped' || request.status === 'delivered') && (
          <SectionCard title="Informations de livraison">
            {request.shipping_company && (
              <InfoRow icon="business" label="Compagnie" value={request.shipping_company} />
            )}
            {request.shipping_code && (
              <InfoRow icon="qr-code" label="Code de retrait" value={request.shipping_code} />
            )}
            {request.shipping_contact && (
              <InfoRow icon="call" label="Contact" value={request.shipping_contact} />
            )}
          </SectionCard>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Viewer d'image avec zoom/pan */}
      <ImageView
        images={viewingImage ? [{ uri: viewingImage.url }] : []}
        imageIndex={0}
        visible={imageViewerVisible}
        onRequestClose={() => setImageViewerVisible(false)}
        HeaderComponent={() => (
          <View style={styles.imageViewerHeader}>
            <Text style={styles.imageViewerTitle} numberOfLines={1}>
              {viewingImage?.name || 'Image'}
            </Text>
            <TouchableOpacity
              style={styles.imageViewerCloseButton}
              onPress={() => setImageViewerVisible(false)}
            >
              <Ionicons name="close" size={28} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
        FooterComponent={() => (
          <View style={styles.imageViewerFooter}>
            <TouchableOpacity
              style={styles.imageViewerButton}
              onPress={() => {
                if (viewingImage) {
                  downloadAttachment(viewingImage.url, viewingImage.name);
                }
              }}
            >
              <Ionicons name="download-outline" size={24} color="#ffffff" />
              <Text style={styles.imageViewerButtonText}>Télécharger</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        {icon && (
          <View style={styles.sectionIconCircle}>
            <Ionicons name={icon as any} size={16} color="#d4af37" />
          </View>
        )}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function InfoRow({ icon, label, value, isPrice }: { icon: string; label: string; value: string; isPrice?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <View style={styles.iconWrapper}>
          <Ionicons name={icon as any} size={16} color="#d4af37" />
        </View>
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, isPrice && styles.priceValue]}>{value}</Text>
    </View>
  );
}

function PaymentLine({ label, amount }: { label: string; amount: number }) {
  return (
    <View style={styles.paymentLine}>
      <Text style={styles.paymentLabel}>{label}</Text>
      <Text style={styles.paymentAmount}>{amount.toLocaleString()} FCFA</Text>
    </View>
  );
}

function AttachmentCard({ attachment, onView, onDownload }: {
  attachment: any;
  onView: () => void;
  onDownload: () => void;
}) {
  const [downloading, setDownloading] = React.useState(false);
  const uploadDate = attachment.created_at
    ? format(new Date(attachment.created_at), 'd MMMM yyyy \'à\' HH:mm', { locale: fr })
    : '';

  // Déterminer le type de fichier pour le badge
  const fileType = attachment.file_type || 'FILE';
  let badgeText = 'FICHIER';
  let badgeColor = '#047857';
  let iconName: any = 'document-attach';

  if (fileType.includes('image')) {
    badgeText = 'IMAGE';
    badgeColor = '#047857';
    iconName = 'image';
  } else if (fileType.includes('pdf')) {
    badgeText = 'PDF';
    badgeColor = '#dc2626';
    iconName = 'document-text';
  } else if (fileType.includes('document') || fileType.includes('word')) {
    badgeText = 'DOCUMENT';
    badgeColor = '#2563eb';
    iconName = 'document';
  }

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await onDownload();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.attachmentCard}
      onPress={onView}
      activeOpacity={0.7}
    >
      <View style={styles.attachmentContent}>
        <View style={[styles.attachmentIconCircle, { backgroundColor: `${badgeColor}15` }]}>
          <Ionicons name={iconName} size={28} color={badgeColor} />
        </View>

        <View style={styles.attachmentInfo}>
          <Text style={styles.attachmentName} numberOfLines={2}>
            {attachment.file_name || 'Document'}
          </Text>
          {uploadDate && (
            <Text style={styles.attachmentDate}>{uploadDate}</Text>
          )}
          <View style={[styles.attachmentBadge, { backgroundColor: badgeColor }]}>
            <Text style={styles.attachmentBadgeText}>{badgeText}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.downloadIconButton}
          onPress={handleDownload}
          disabled={downloading}
        >
          <Ionicons
            name={downloading ? "hourglass-outline" : "download-outline"}
            size={24}
            color="#047857"
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },

  // Header personnalisé
  header: {
    backgroundColor: '#047857',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 40,
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },

  // Carte Statut
  statusCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    position: 'relative',
  },
  goldAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#d4af37',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  dateText: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '500',
  },
  documentSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  documentIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#faf8f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#d4af37',
  },
  documentTitle: {
    flex: 1,
    color: '#047857',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#faf8f5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#d4af37',
  },
  personName: {
    flex: 1,
    color: '#047857',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  marriageTag: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  marriageText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
  },

  // Section Cards
  sectionCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#faf8f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#d4af37',
  },
  sectionTitle: {
    color: '#047857',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionContent: {
    // Container pour le contenu
  },

  // Info Row
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#faf8f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  infoLabel: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '500',
  },
  infoValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  priceValue: {
    color: '#047857',
    fontSize: 16,
    fontWeight: '800',
  },

  // Error
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
  },

  // Payment Summary
  paymentSummary: {
    // Container for payment lines
  },
  paymentLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  paymentLabel: {
    color: '#6b7280',
    fontSize: 13,
    flex: 1,
    paddingRight: 8,
  },
  paymentAmount: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 2,
    borderTopColor: '#047857',
    marginTop: 8,
  },
  totalLabel: {
    color: '#047857',
    fontSize: 15,
    fontWeight: '700',
  },
  totalAmount: {
    color: '#047857',
    fontSize: 16,
    fontWeight: '800',
  },

  // Attachment Card
  attachmentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  attachmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachmentIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  attachmentDate: {
    color: '#6b7280',
    fontSize: 11,
    marginBottom: 6,
  },
  attachmentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  attachmentBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  downloadIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#047857',
  },

  // Bottom padding
  bottomPadding: {
    height: 32,
  },

  // Image Viewer Header/Footer
  imageViewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  imageViewerTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 16,
  },
  imageViewerCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  imageViewerFooter: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  imageViewerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#047857',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  imageViewerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
