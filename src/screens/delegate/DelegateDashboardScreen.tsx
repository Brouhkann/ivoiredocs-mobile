import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, Alert, Image } from 'react-native';
import { Text, Avatar, FAB, TextInput, Button as PaperButton } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../config/supabase';
import { toast } from '../../stores/toastStore';
import type { Request } from '../../types';
import AppHeader from '../../components/AppHeader';

interface DelegateStats {
  totalRequests: number;
  completedRequests: number;
  totalEarnings: number;
  pendingRequests: number;
}

export default function DelegateDashboardScreen({ navigation }: any) {
  const { user, profile } = useAuthStore();
  const [stats, setStats] = useState<DelegateStats>({
    totalRequests: 0,
    completedRequests: 0,
    totalEarnings: 0,
    pendingRequests: 0,
  });
  const [activeRequests, setActiveRequests] = useState<Request[]>([]);
  const [recentRequests, setRecentRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'recent'>('active');

  // Modal d'information de livraison (status: in_progress)
  const [showDeliveryInfoModal, setShowDeliveryInfoModal] = useState(false);
  const [selectedRequestForDeliveryInfo, setSelectedRequestForDeliveryInfo] = useState<Request | null>(null);

  // Modal d'expédition (status: ready)
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [selectedRequestForShipping, setSelectedRequestForShipping] = useState<Request | null>(null);
  const [shippingData, setShippingData] = useState({
    code_expedition: '',
    compagnie: '',
    contact_transport: '',
    photo_recu: null as { uri: string; name: string; type: string } | null,
  });

  // Fonction pour obtenir la dotation du délégué
  const getDelegateEarnings = useCallback((request: Request) => {
    // Si pas de billing_details, utiliser delegate_earnings
    if (!request?.form_data?.billing_details) {
      return request.delegate_earnings || 0;
    }

    // Calcul depuis billing_details
    const { documents, prestation, shipping } = request.form_data.billing_details;

    if (documents && prestation) {
      const documentsTotal = documents.reduce((sum: number, doc: any) => sum + doc.total_price, 0);
      const prestationMoitie = Math.round(prestation.amount / 2);
      const expeditionTotal = shipping ? shipping.amount : 0;
      return documentsTotal + prestationMoitie + expeditionTotal;
    }

    return 0;
  }, []);

  const fetchDelegateData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      }

      // Récupérer les stats du délégué
      const { data: delegate, error: delegateError } = await supabase
        .from('delegates')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (delegateError) {
        throw delegateError;
      }

      // Récupérer toutes les demandes affectées
      const { data: allRequests, error: requestsError } = await supabase
        .from('requests')
        .select(`
          *,
          users:user_id (
            name,
            phone,
            email
          )
        `)
        .eq('delegate_id', delegate.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (requestsError) throw requestsError;

      // Filtrer les demandes actives
      const activeRequests =
        allRequests?.filter((r) =>
          ['assigned', 'in_progress', 'ready'].includes(r.status)
        ) || [];

      // Demandes récentes (toutes les demandes)
      const recentRequests = allRequests?.slice(0, 15) || [];

      // Demandes complétées
      const completedRequests =
        allRequests?.filter((r) => ['shipped', 'delivered', 'completed'].includes(r.status)) || [];

      // Total = En cours + Terminées
      const totalRequests = activeRequests.length + completedRequests.length;

      setStats({
        totalRequests: totalRequests,
        completedRequests: completedRequests.length,
        totalEarnings: delegate.total_earnings || 0,
        pendingRequests: activeRequests.length,
      });

      setActiveRequests(activeRequests);
      setRecentRequests(recentRequests);
    } catch (error: any) {
      console.error('Erreur chargement données délégué:', error);
      toast.error(error.message || 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      fetchDelegateData();
    }
  }, [user, fetchDelegateData]);

  const handleRefresh = useCallback(() => {
    fetchDelegateData(true);
  }, [fetchDelegateData]);

  const updateRequestStatus = async (requestId: string, newStatus: string) => {
    try {
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
      }

      const { error } = await supabase
        .from('requests')
        .update(updateData)
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Statut mis à jour avec succès');
      fetchDelegateData();
    } catch (error) {
      console.error('Erreur mise à jour status:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleNextStep = async (request: Request) => {
    console.log('🔵 handleNextStep', { requestId: request.id, status: request.status });

    switch (request.status) {
      case 'assigned':
        // Commencer: passer à 'in_progress' directement
        await updateRequestStatus(request.id, 'in_progress');
        break;
      case 'in_progress':
        // Documents prêts: afficher le modal d'infos de livraison
        setSelectedRequestForDeliveryInfo(request);
        setShowDeliveryInfoModal(true);
        break;
      case 'ready':
        // Expédier: afficher le modal d'expédition
        setSelectedRequestForShipping(request);
        setShowShippingModal(true);
        break;
      default:
        break;
    }
  };

  // Confirmer que les documents sont prêts (in_progress -> ready)
  const handleConfirmDocumentsReady = async () => {
    if (!selectedRequestForDeliveryInfo) return;

    await updateRequestStatus(selectedRequestForDeliveryInfo.id, 'ready');
    setShowDeliveryInfoModal(false);
    setSelectedRequestForDeliveryInfo(null);
  };

  // Prendre une photo du reçu d'expédition
  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la caméra');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setShippingData({
          ...shippingData,
          photo_recu: {
            uri: asset.uri,
            name: `shipping_receipt_${Date.now()}.jpg`,
            type: 'image/jpeg',
          },
        });
      }
    } catch (error) {
      console.error('Erreur prise de photo:', error);
      toast.error('Erreur lors de la prise de photo');
    }
  };

  // Choisir une photo depuis la galerie
  const handlePickPhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la galerie');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setShippingData({
          ...shippingData,
          photo_recu: {
            uri: asset.uri,
            name: `shipping_receipt_${Date.now()}.jpg`,
            type: 'image/jpeg',
          },
        });
      }
    } catch (error) {
      console.error('Erreur sélection photo:', error);
      toast.error('Erreur lors de la sélection de la photo');
    }
  };

  // Supprimer la photo
  const handleRemovePhoto = () => {
    setShippingData({
      ...shippingData,
      photo_recu: null,
    });
  };

  // Uploader la photo vers Supabase Storage
  const uploadShippingPhoto = async (requestId: string, photo: { uri: string; name: string; type: string }): Promise<string | null> => {
    try {
      console.log('📤 Début upload photo:', photo.name);

      // Créer le chemin de stockage
      const filePath = `shipping-receipts/${requestId}/${photo.name}`;

      // Lire le fichier en ArrayBuffer (meilleur pour React Native)
      const response = await fetch(photo.uri);
      const arrayBuffer = await response.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);

      console.log('📊 Taille fichier:', fileData.length, 'bytes');

      // Uploader vers Supabase Storage (bucket "documents")
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(filePath, fileData, {
          contentType: photo.type,
          upsert: true,
        });

      if (error) {
        console.error('❌ Erreur upload Supabase:', error);
        return null;
      }

      console.log('✅ Upload réussi:', data);

      // Obtenir l'URL publique
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      console.log('🔗 URL publique générée:', urlData.publicUrl);

      return urlData.publicUrl;
    } catch (error) {
      console.error('❌ Erreur upload photo:', error);
      return null;
    }
  };

  // Confirmer l'expédition (ready -> shipped)
  const handleConfirmShipping = async () => {
    if (!selectedRequestForShipping) return;

    // Validation : compagnie obligatoire
    if (!shippingData.compagnie) {
      Alert.alert('Champ manquant', 'Veuillez renseigner la compagnie de transport');
      return;
    }

    // Validation : au moins le code OU la photo
    if (!shippingData.code_expedition && !shippingData.photo_recu) {
      Alert.alert(
        'Information manquante',
        'Veuillez soit saisir le code d\'expédition, soit prendre une photo du reçu'
      );
      return;
    }

    try {
      const currentTime = new Date().toISOString();
      let photoUrl: string | null = null;

      // Uploader la photo si présente
      if (shippingData.photo_recu) {
        toast.info('Upload de la photo en cours...');
        photoUrl = await uploadShippingPhoto(selectedRequestForShipping.id, shippingData.photo_recu);

        if (!photoUrl) {
          Alert.alert(
            'Erreur photo',
            'L\'upload de la photo a échoué. Voulez-vous continuer sans la photo ?',
            [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Continuer', onPress: () => confirmShippingWithoutPhoto() },
            ]
          );
          return;
        }
      }

      const { error } = await supabase
        .from('requests')
        .update({
          status: 'shipped',
          shipping_code: shippingData.code_expedition,
          shipping_company: shippingData.compagnie,
          shipping_contact: shippingData.contact_transport,
          shipping_receipt_photo: photoUrl,
          shipped_at: currentTime,
        })
        .eq('id', selectedRequestForShipping.id);

      if (error) throw error;

      toast.success('Expédition confirmée avec succès');
      setShowShippingModal(false);
      setSelectedRequestForShipping(null);
      setShippingData({
        code_expedition: '',
        compagnie: '',
        contact_transport: '',
        photo_recu: null,
      });
      fetchDelegateData();
    } catch (error) {
      console.error('Erreur confirmation expédition:', error);
      toast.error('Erreur lors de la confirmation');
    }
  };

  // Confirmer sans photo (fallback)
  const confirmShippingWithoutPhoto = async () => {
    if (!selectedRequestForShipping) return;

    try {
      const currentTime = new Date().toISOString();
      const { error } = await supabase
        .from('requests')
        .update({
          status: 'shipped',
          shipping_code: shippingData.code_expedition,
          shipping_company: shippingData.compagnie,
          shipping_contact: shippingData.contact_transport,
          shipped_at: currentTime,
        })
        .eq('id', selectedRequestForShipping.id);

      if (error) throw error;

      toast.success('Expédition confirmée avec succès');
      setShowShippingModal(false);
      setSelectedRequestForShipping(null);
      setShippingData({
        code_expedition: '',
        compagnie: '',
        contact_transport: '',
        photo_recu: null,
      });
      fetchDelegateData();
    } catch (error) {
      console.error('Erreur confirmation expédition:', error);
      toast.error('Erreur lors de la confirmation');
    }
  };

  const getButtonConfig = (status: string) => {
    switch (status) {
      case 'assigned':
        return {
          label: '🚀 Commencer',
          color: '#047857',
        };
      case 'in_progress':
        return {
          label: '📦 Documents prêts',
          color: '#047857',
        };
      case 'ready':
        return {
          label: '✅ Expédier',
          color: '#047857',
        };
      default:
        return {
          label: 'Voir détails',
          color: '#6b7280',
        };
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      delivered: 'Livré',
      shipped: 'Expédié',
      ready: 'Prêt',
      in_progress: 'En cours',
      assigned: 'Assigné',
      completed: 'Terminé',
      new: 'Nouveau',
    };
    return labels[status] || status;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
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
      <AppHeader
        userName={profile?.name?.split(' ')[0] || 'Délégué'}
        showLogo={true}
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
        {/* Statistiques */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Vue d'ensemble</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCardCompact}>
              <View style={styles.goldAccentSmall} />
              <Ionicons name="document-text" size={18} color="#047857" />
              <Text style={styles.statTextCompact}>
                <Text style={styles.statNumberCompact}>{stats.totalRequests}</Text>
                {' '}Total missions
              </Text>
            </View>

            <View style={styles.statCardCompact}>
              <View style={styles.goldAccentSmall} />
              <Ionicons name="time" size={18} color="#d97706" />
              <Text style={styles.statTextCompact}>
                <Text style={styles.statNumberCompact}>{stats.pendingRequests}</Text>
                {' '}En cours
              </Text>
            </View>
          </View>

          {/* Bouton Dotations */}
          <TouchableOpacity
            style={styles.earningsButton}
            onPress={() => navigation.navigate('DelegateEarnings')}
          >
            <View style={styles.earningsButtonIcon}>
              <Ionicons name="wallet" size={22} color="#047857" />
            </View>
            <View style={styles.earningsButtonContent}>
              <Text style={styles.earningsButtonTitle}>Mes dotations</Text>
              <Text style={styles.earningsButtonSubtitle}>
                {stats.totalEarnings.toLocaleString()} FCFA
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#047857" />
          </TouchableOpacity>
        </View>

        {/* Onglets */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'active' && styles.tabActive]}
            onPress={() => setActiveTab('active')}
          >
            <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
              Actives ({activeRequests.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'recent' && styles.tabActive]}
            onPress={() => setActiveTab('recent')}
          >
            <Text style={[styles.tabText, activeTab === 'recent' && styles.tabTextActive]}>
              Récentes ({recentRequests.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Liste des demandes */}
        <View style={styles.requestsSection}>
          {activeTab === 'active' ? (
            activeRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={64} color="#d1d5db" />
                <Text style={styles.emptyTitle}>Aucune mission active</Text>
                <Text style={styles.emptyText}>
                  Les nouvelles missions apparaîtront ici
                </Text>
              </View>
            ) : (
              activeRequests.map((request) => (
                <MissionCard
                  key={request.id}
                  request={request}
                  onPress={() => navigation.navigate('DelegateRequestDetail', { requestId: request.id })}
                  onActionPress={() => handleNextStep(request)}
                  getDelegateEarnings={getDelegateEarnings}
                  getButtonConfig={getButtonConfig}
                  getStatusLabel={getStatusLabel}
                  formatDate={formatDate}
                />
              ))
            )
          ) : (
            recentRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={64} color="#d1d5db" />
                <Text style={styles.emptyTitle}>Aucune mission récente</Text>
                <Text style={styles.emptyText}>
                  Les missions récentes apparaîtront ici
                </Text>
              </View>
            ) : (
              recentRequests.map((request) => (
                <RecentRequestCard
                  key={request.id}
                  request={request}
                  onPress={() => navigation.navigate('DelegateRequestDetail', { requestId: request.id })}
                  getDelegateEarnings={getDelegateEarnings}
                  getStatusLabel={getStatusLabel}
                  formatDate={formatDate}
                />
              ))
            )
          )}
        </View>
      </ScrollView>

      {/* Modal d'information de livraison (status: in_progress) */}
      <Modal
        visible={showDeliveryInfoModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDeliveryInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📦 Informations de livraison</Text>
              <TouchableOpacity onPress={() => setShowDeliveryInfoModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedRequestForDeliveryInfo && (() => {
                const deliveryData = selectedRequestForDeliveryInfo.form_data?.delivery_data || {};
                const moyenRecup = deliveryData.moyen_recuperation;
                const villeDestination = deliveryData.ville_destination;
                const nomDestinataire = deliveryData.nom_destinataire;
                const contact = deliveryData.contact1;

                return (
                  <>
                    <View style={styles.infoCard}>
                      <Text style={styles.infoCardTitle}>📍 Destination</Text>
                      <Text style={styles.infoCardValue}>{villeDestination || 'Non renseignée'}</Text>
                    </View>

                    <View style={styles.infoCard}>
                      <Text style={styles.infoCardTitle}>👤 Destinataire</Text>
                      <Text style={styles.infoCardValue}>{nomDestinataire || 'Non renseigné'}</Text>
                      {contact && <Text style={styles.infoCardSubValue}>📞 {contact}</Text>}
                    </View>

                    <View style={styles.infoCard}>
                      <Text style={styles.infoCardTitle}>🚚 Mode de récupération</Text>
                      <Text style={styles.infoCardValue}>
                        {moyenRecup === 'moi_meme_gare' ? 'Retrait en gare' :
                         moyenRecup === 'livraison_express' ? 'Livraison express' :
                         'Retrait au bureau'}
                      </Text>
                    </View>

                    {moyenRecup === 'moi_meme_gare' && deliveryData.preference_transport && (
                      <View style={styles.infoCard}>
                        <Text style={styles.infoCardTitle}>🏢 Compagnie de transport</Text>
                        <Text style={styles.infoCardValue}>{deliveryData.preference_transport}</Text>
                      </View>
                    )}

                    <View style={styles.warningBox}>
                      <Ionicons name="information-circle" size={20} color="#047857" />
                      <Text style={styles.warningText}>
                        Vérifiez les informations ci-dessus avant de marquer les documents comme prêts.
                      </Text>
                    </View>
                  </>
                );
              })()}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setShowDeliveryInfoModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonPrimary}
                onPress={handleConfirmDocumentsReady}
              >
                <Text style={styles.modalButtonPrimaryText}>✅ Confirmer documents prêts</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal d'expédition (status: ready) */}
      <Modal
        visible={showShippingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShippingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📦 Confirmer l'expédition</Text>
              <TouchableOpacity onPress={() => setShowShippingModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalDescription}>
                Renseignez les informations de l'expédition effectuée
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Compagnie de transport *</Text>
                <TextInput
                  mode="outlined"
                  placeholder="Ex: UTB Transport, STEB, MSA..."
                  value={shippingData.compagnie}
                  onChangeText={(text) => setShippingData({ ...shippingData, compagnie: text })}
                  style={styles.textInput}
                  outlineColor="#d1d5db"
                  activeOutlineColor="#047857"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Code d'expédition (optionnel)</Text>
                <TextInput
                  mode="outlined"
                  placeholder="Ex: RT-2024-001234"
                  value={shippingData.code_expedition}
                  onChangeText={(text) => setShippingData({ ...shippingData, code_expedition: text.toUpperCase() })}
                  style={styles.textInput}
                  outlineColor="#d1d5db"
                  activeOutlineColor="#047857"
                />
                <Text style={styles.inputHint}>💡 Saisissez le code OU prenez une photo du reçu</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Contact transport (optionnel)</Text>
                <TextInput
                  mode="outlined"
                  placeholder="Ex: +225 01 02 03 04 05"
                  value={shippingData.contact_transport}
                  onChangeText={(text) => setShippingData({ ...shippingData, contact_transport: text })}
                  style={styles.textInput}
                  keyboardType="phone-pad"
                  outlineColor="#d1d5db"
                  activeOutlineColor="#047857"
                />
              </View>

              {/* Photo du reçu */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Photo du reçu d'expédition 📸</Text>
                {shippingData.photo_recu ? (
                  <View style={styles.photoPreviewContainer}>
                    <Image
                      source={{ uri: shippingData.photo_recu.uri }}
                      style={styles.photoPreview}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={handleRemovePhoto}
                    >
                      <Ionicons name="close-circle" size={32} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.photoButtons}>
                    <TouchableOpacity
                      style={styles.photoButton}
                      onPress={handleTakePhoto}
                    >
                      <Ionicons name="camera" size={28} color="#047857" />
                      <Text style={styles.photoButtonText}>Prendre une photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.photoButton}
                      onPress={handlePickPhoto}
                    >
                      <Ionicons name="images" size={28} color="#047857" />
                      <Text style={styles.photoButtonText}>Choisir de la galerie</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={styles.photoHint}>
                  💡 Photo recommandée : plus simple, plus rapide et plus fiable
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setShowShippingModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonPrimary}
                onPress={handleConfirmShipping}
              >
                <Text style={styles.modalButtonPrimaryText}>✅ Valider l'expédition</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Composant carte de mission active
function MissionCard({
  request,
  onPress,
  onActionPress,
  getDelegateEarnings,
  getButtonConfig,
  getStatusLabel,
  formatDate,
}: any) {
  // Récupérer les données de livraison (peuvent être à différents endroits selon la version)
  const deliveryData = request.form_data?.delivery_data || request.form_data || {};
  const villeDestination = deliveryData.ville_destination || request.city;
  const nomDestinataire = deliveryData.nom_destinataire;
  const contactDestinataire = deliveryData.contact1;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.missionCard}
      activeOpacity={0.7}
    >
      <View style={styles.goldAccent} />

      {/* Header de la carte */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{getStatusLabel(request.status)}</Text>
          </View>
          <Text style={styles.requestId}>#{request.id.slice(-6).toUpperCase()}</Text>
        </View>
        <Text style={styles.earningsText}>{getDelegateEarnings(request).toLocaleString()} F</Text>
      </View>

      {/* Informations du document */}
      <View style={styles.cardBody}>
        <Text style={styles.documentTitle}>
          {request.document_type} - {request.copies} copie{request.copies > 1 ? 's' : ''}
        </Text>

        {/* Informations spécifiques */}
        {(request.form_data?.nom_complet || request.form_data?.numero_acte_naissance) && (
          <View style={styles.documentInfo}>
            {request.form_data?.nom_complet && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nom complet:</Text>
                <Text style={styles.infoValue}>{request.form_data.nom_complet}</Text>
              </View>
            )}
            {request.form_data?.numero_acte_naissance && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>N° acte:</Text>
                <Text style={styles.infoValueHighlight}>{request.form_data.numero_acte_naissance}</Text>
              </View>
            )}
          </View>
        )}

        {/* Destination et date */}
        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="location" size={14} color="#6b7280" />
            <Text style={styles.metaText}>{villeDestination}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time" size={14} color="#6b7280" />
            <Text style={styles.metaText}>{formatDate(request.created_at)}</Text>
          </View>
        </View>

        {/* Destinataire */}
        {nomDestinataire && (
          <View style={styles.clientInfo}>
            <Avatar.Text
              size={32}
              label={nomDestinataire.charAt(0)}
              style={styles.clientAvatar}
            />
            <View style={styles.clientDetails}>
              <Text style={styles.clientName}>{nomDestinataire}</Text>
              <Text style={styles.clientPhone}>{contactDestinataire || 'Contact non renseigné'}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Bouton d'action */}
      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation();
          onActionPress();
        }}
        style={[styles.actionButton, { backgroundColor: getButtonConfig(request.status).color }]}
      >
        <Text style={styles.actionButtonText}>{getButtonConfig(request.status).label}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// Composant carte de mission récente
function RecentRequestCard({
  request,
  onPress,
  getDelegateEarnings,
  getStatusLabel,
  formatDate,
}: any) {
  // Récupérer les données de livraison
  const deliveryData = request.form_data?.delivery_data || request.form_data || {};
  const villeDestination = deliveryData.ville_destination || request.city;
  const nomDestinataire = deliveryData.nom_destinataire;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.recentCard}
      activeOpacity={0.7}
    >
      <View style={styles.recentCardHeader}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{getStatusLabel(request.status)}</Text>
        </View>
        <Text style={styles.earningsTextSmall}>{getDelegateEarnings(request).toLocaleString()} F</Text>
      </View>

      <Text style={styles.documentTitleSmall}>
        {request.document_type} - {request.copies} copie{request.copies > 1 ? 's' : ''}
      </Text>

      {/* Destinataire et destination */}
      {nomDestinataire && (
        <Text style={styles.destinataireNameSmall}>
          👤 {nomDestinataire}
        </Text>
      )}
      <Text style={styles.destinationSmall}>
        📍 {villeDestination}
      </Text>

      <View style={styles.recentCardMeta}>
        <Text style={styles.metaTextSmall}>{formatDate(request.created_at)}</Text>
        <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
      </View>
    </TouchableOpacity>
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
    paddingBottom: 40,
  },
  statsSection: {
    padding: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCardCompact: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
    elevation: 3,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1.5,
    borderColor: '#d1fae5',
    overflow: 'hidden',
  },
  goldAccentSmall: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#d4af37',
  },
  statTextCompact: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  statNumberCompact: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },
  earningsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#a7f3d0',
  },
  earningsButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  earningsButtonContent: {
    flex: 1,
  },
  earningsButtonTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#047857',
  },
  earningsButtonSubtitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
  },
  statCardLarge: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#d1fae5',
    overflow: 'hidden',
  },
  statIconContainerLarge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    marginTop: 2,
  },
  statValueLarge: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 1,
    letterSpacing: 0.1,
    lineHeight: 18,
  },
  statLabelLarge: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 12,
  },
  statCard: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#ecfdf5',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 6,
    elevation: 2,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#047857',
    elevation: 3,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  requestsSection: {
    paddingHorizontal: 20,
  },
  missionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 2,
    borderColor: '#bbf7d0',
    overflow: 'hidden',
  },
  goldAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: '#d4af37',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
  },
  statusText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  requestId: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '700',
  },
  earningsText: {
    fontSize: 19,
    fontWeight: '900',
    color: '#047857',
    letterSpacing: 0.5,
  },
  cardBody: {
    padding: 16,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  documentInfo: {
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
  },
  infoRow: {
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },
  infoValueHighlight: {
    fontSize: 14,
    color: '#047857',
    fontWeight: '800',
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  destinataireInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
  },
  destinataireText: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  clientAvatar: {
    backgroundColor: '#d1d5db',
  },
  clientDetails: {
    flex: 1,
  },
  clientName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  clientPhone: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '600',
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  recentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  recentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  earningsTextSmall: {
    fontSize: 15,
    fontWeight: '800',
    color: '#047857',
  },
  documentTitleSmall: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  destinataireNameSmall: {
    fontSize: 13,
    color: '#047857',
    marginBottom: 4,
    fontWeight: '700',
  },
  destinationSmall: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
    fontWeight: '600',
  },
  clientNameSmall: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  recentCardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaTextSmall: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#374151',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Styles pour les modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#047857',
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  modalDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  infoCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  infoCardValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  infoCardSubValue: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#047857',
    gap: 12,
    alignItems: 'flex-start',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#047857',
    fontWeight: '600',
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#047857',
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
    fontStyle: 'italic',
  },
  textInput: {
    backgroundColor: '#ffffff',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  modalButtonSecondaryText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '700',
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: '#047857',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalButtonPrimaryText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  // Styles pour la photo
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  photoButton: {
    flex: 1,
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d1fae5',
    borderStyle: 'dashed',
  },
  photoButtonText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
    textAlign: 'center',
  },
  photoHint: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  photoPreviewContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#047857',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
