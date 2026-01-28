import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking, Image, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { toast } from '../../stores/toastStore';
import Loading from '../../components/ui/Loading';
import { supabase } from '../../config/supabase';
import { type Invoice, cancelInvoice } from '../../services/wavePaymentService';

const WAVE_PAYMENT_BASE_URL = 'https://pay.wave.com/m/M_ci_i7JxKIwiaf99/c/ci/?amount=';

export default function InvoiceActionScreen({ route, navigation }: any) {
  const { invoice } = route.params as { invoice: Invoice };
  const [loading, setLoading] = useState(false);
  const [proofImage, setProofImage] = useState<string | null>(null);

  // Ouvrir Wave pour payer
  const handlePayWithWave = async () => {
    const waveLink = `${WAVE_PAYMENT_BASE_URL}${invoice.amount}`;
    try {
      await Linking.openURL(waveLink);
    } catch (error) {
      toast.error("Impossible d'ouvrir Wave");
    }
  };

  // Supprimer/Annuler la facture
  const handleDeleteInvoice = () => {
    Alert.alert(
      'Annuler la demande',
      'Êtes-vous sûr de vouloir annuler cette demande ? Cette action est irréversible.',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const success = await cancelInvoice(invoice.id);
              if (success) {
                toast.success('Demande annulée');
                navigation.goBack();
              } else {
                toast.error('Erreur lors de l\'annulation');
              }
            } catch (error) {
              toast.error('Erreur lors de l\'annulation');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Modifier la demande (pré-remplir le formulaire)
  const handleModifyRequest = () => {
    Alert.alert(
      'Modifier la demande',
      'Vous allez être redirigé vers le formulaire avec vos informations pré-remplies. Continuer ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, modifier',
          onPress: async () => {
            try {
              setLoading(true);
              await cancelInvoice(invoice.id);

              // Récupérer les données de la demande depuis la facture
              const requestData = invoice.metadata?.request_data;

              // Rediriger vers le formulaire avec les données pré-remplies
              navigation.reset({
                index: 0,
                routes: [
                  { name: 'Main' },
                  {
                    name: 'RequestForm',
                    params: {
                      documentType: invoice.metadata?.document_type,
                      prefillData: {
                        city: invoice.metadata?.city,
                        service_type: invoice.metadata?.service_type,
                        copies: invoice.metadata?.copies,
                        form_data: requestData?.form_data,
                      }
                    }
                  },
                ],
              });
            } catch (error) {
              toast.error('Erreur');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Sélectionner depuis la galerie
  const handleSelectImage = async () => {
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
      console.error('Erreur galerie:', error);
    }
  };

  // Prendre une photo
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
      console.error('Erreur caméra:', error);
    }
  };

  // Soumettre la preuve
  const handleSubmitProof = async () => {
    if (!proofImage) {
      toast.error('Ajoutez une capture d\'écran');
      return;
    }

    try {
      setLoading(true);

      const fileName = `payment_proofs/${invoice.id}_${Date.now()}.jpg`;
      const response = await fetch(proofImage);
      const blob = await response.blob();

      const { data: uploadData } = await supabase.storage
        .from('documents')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

      await supabase
        .from('invoices')
        .update({
          payment_proof_url: uploadData?.path || proofImage,
          status: 'pending_verification',
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);

      toast.success('Preuve envoyée !');
      navigation.goBack();
    } catch (error: any) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading message="Envoi en cours..." />;
  }

  const isPending = invoice.status === 'pending';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Facture {invoice.reference}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Info facture */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Document</Text>
            <Text style={styles.infoValue}>{invoice.metadata?.document_type}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ville</Text>
            <Text style={styles.infoValue}>{invoice.metadata?.city}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Copies</Text>
            <Text style={styles.infoValue}>{invoice.metadata?.copies}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Montant</Text>
            <Text style={styles.infoAmount}>{invoice.amount.toLocaleString()} FCFA</Text>
          </View>
        </View>

        {/* Statut */}
        <View style={[styles.statusCard, !isPending && styles.statusCardVerif]}>
          <Ionicons
            name={isPending ? 'alert-circle' : 'hourglass'}
            size={28}
            color={isPending ? '#f59e0b' : '#3b82f6'}
          />
          <Text style={[styles.statusText, !isPending && { color: '#3b82f6' }]}>
            {isPending
              ? 'En attente de paiement'
              : 'Preuve en cours de vérification'}
          </Text>
        </View>

        {isPending && (
          <>
            {/* Image Wave */}
            <View style={styles.waveImageContainer}>
              <Image
                source={require('../../../assets/wave-button.png')}
                style={styles.waveImage}
                resizeMode="contain"
              />
            </View>

            {/* Bouton Payer */}
            <TouchableOpacity style={styles.payBtn} onPress={handlePayWithWave}>
              <Ionicons name="wallet-outline" size={22} color="#fff" />
              <Text style={styles.payBtnText}>Payer avec Wave</Text>
            </TouchableOpacity>

            {/* Séparateur */}
            <View style={styles.separator}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>ou</Text>
              <View style={styles.separatorLine} />
            </View>

            {/* Upload preuve */}
            <Text style={styles.proofTitle}>Ajouter une preuve de paiement</Text>

            {proofImage ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: proofImage }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => setProofImage(null)}
                >
                  <Ionicons name="close-circle" size={32} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.uploadBtns}>
                <TouchableOpacity style={styles.uploadBtn} onPress={handleSelectImage}>
                  <Ionicons name="images" size={32} color="#047857" />
                  <Text style={styles.uploadBtnLabel}>Galerie</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.uploadBtn} onPress={handleTakePhoto}>
                  <Ionicons name="camera" size={32} color="#047857" />
                  <Text style={styles.uploadBtnLabel}>Caméra</Text>
                </TouchableOpacity>
              </View>
            )}

            {proofImage && (
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitProof}>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>Envoyer la preuve</Text>
              </TouchableOpacity>
            )}

            {/* Actions supplémentaires */}
            <View style={styles.extraActions}>
              <TouchableOpacity style={styles.modifyBtn} onPress={handleModifyRequest}>
                <Ionicons name="create-outline" size={18} color="#3b82f6" />
                <Text style={styles.modifyBtnText}>Modifier la demande</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteInvoice}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                <Text style={styles.deleteBtnText}>Annuler la demande</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {!isPending && (
          <View style={styles.waitingBox}>
            <Ionicons name="time-outline" size={24} color="#3b82f6" />
            <Text style={styles.waitingText}>
              Votre preuve de paiement est en cours de vérification.
              Vous serez notifié dès validation.
            </Text>
          </View>
        )}
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
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  infoAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#047857',
  },
  statusCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  statusCardVerif: {
    backgroundColor: '#dbeafe',
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f59e0b',
  },
  waveImageContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  waveImage: {
    width: '100%',
    height: 70,
  },
  payBtn: {
    backgroundColor: '#047857',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#d1d5db',
  },
  separatorText: {
    marginHorizontal: 16,
    color: '#6b7280',
    fontSize: 14,
  },
  proofTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  uploadBtns: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  uploadBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#a7f3d0',
    borderStyle: 'dashed',
  },
  uploadBtnLabel: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  previewContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 250,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  removeBtn: {
    position: 'absolute',
    top: -12,
    right: -12,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  submitBtn: {
    backgroundColor: '#047857',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  waitingBox: {
    backgroundColor: '#dbeafe',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  waitingText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 22,
  },
  extraActions: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  modifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  modifyBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3b82f6',
  },
  deleteBtn: {
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
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ef4444',
  },
});
