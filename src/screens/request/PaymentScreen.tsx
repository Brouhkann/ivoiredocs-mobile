import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking, Image } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { DOCUMENT_CONFIGS } from '../../utils/documents';
import { toast } from '../../stores/toastStore';
import { useAuthStore } from '../../stores/authStore';
import Loading from '../../components/ui/Loading';
import {
  createInvoice,
  type Invoice,
} from '../../services/wavePaymentService';
import { supabase } from '../../config/supabase';

// Lien Wave de base (sans le montant)
const WAVE_PAYMENT_BASE_URL = 'https://pay.wave.com/m/M_ci_i7JxKIwiaf99/c/ci/?amount=';

export default function PaymentScreen({ route, navigation }: any) {
  const { requestData } = route.params;
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);

  const [processing, setProcessing] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [step, setStep] = useState<'summary' | 'payment' | 'confirmation'>('summary');
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const documentConfig = DOCUMENT_CONFIGS[requestData.document_type];

  // Générer le lien Wave avec le montant
  const getWavePaymentLink = (amount: number) => {
    return `${WAVE_PAYMENT_BASE_URL}${amount}`;
  };

  // Créer la facture et passer à l'étape de paiement
  const handleCreateInvoice = async () => {
    try {
      if (!user?.id) {
        toast.error('Vous devez être connecté');
        return;
      }

      setProcessing(true);

      const result = await createInvoice({
        user_id: user.id,
        amount: requestData.total_amount,
        document_type: requestData.document_type,
        city: requestData.city,
        service_type: requestData.service_type,
        copies: requestData.copies,
        customer_name: profile?.name || requestData.form_data?.nom_destinataire || '',
        customer_phone: profile?.phone || requestData.form_data?.contact1 || '',
        billing_details: requestData.form_data?.billing_details,
        request_data: requestData,
      });

      if (!result.success || !result.invoice) {
        throw new Error(result.error || 'Erreur lors de la création de la facture');
      }

      setInvoice(result.invoice);
      setStep('payment');
      toast.success('Facture créée !');
    } catch (error: any) {
      console.error('Erreur création facture:', error);
      toast.error(error.message || 'Erreur lors de la création de la facture');
    } finally {
      setProcessing(false);
    }
  };

  // Ouvrir Wave pour le paiement
  const handleOpenWave = async () => {
    if (!invoice) return;

    const waveLink = getWavePaymentLink(invoice.amount);

    try {
      const supported = await Linking.canOpenURL(waveLink);
      if (supported) {
        await Linking.openURL(waveLink);
        // Passer à l'étape de confirmation après ouverture de Wave
        setTimeout(() => {
          setStep('confirmation');
        }, 1000);
      } else {
        toast.error("Impossible d'ouvrir Wave. Vérifiez que l'application est installée.");
      }
    } catch (error) {
      console.error('Erreur ouverture Wave:', error);
      toast.error("Erreur lors de l'ouverture de Wave");
    }
  };

  // Sélectionner une image de preuve de paiement
  const handleSelectProofImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Permission requise pour accéder à la galerie');
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
      console.error('Erreur sélection image:', error);
      toast.error('Erreur lors de la sélection de l\'image');
    }
  };

  // Prendre une photo de la preuve
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Permission requise pour utiliser la caméra');
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
      console.error('Erreur prise photo:', error);
      toast.error('Erreur lors de la prise de photo');
    }
  };

  // Soumettre la preuve de paiement
  const handleSubmitProof = async () => {
    if (!proofImage || !invoice) {
      toast.error('Veuillez ajouter une capture d\'écran du paiement');
      return;
    }

    try {
      setUploading(true);

      // Upload de l'image vers Supabase Storage
      const fileName = `payment_proofs/${invoice.id}_${Date.now()}.jpg`;

      // Convertir l'URI en blob
      const response = await fetch(proofImage);
      const blob = await response.blob();

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('Erreur upload:', uploadError);
        // On continue même si l'upload échoue, on sauvegarde l'URI locale
      }

      // Mettre à jour la facture avec la preuve de paiement
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          payment_proof_url: uploadData?.path || proofImage,
          status: 'pending_verification',
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);

      if (updateError) {
        throw updateError;
      }

      toast.success('Preuve de paiement envoyée ! Nous vérifions votre paiement.');

      // Retourner au dashboard
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } catch (error: any) {
      console.error('Erreur soumission preuve:', error);
      toast.error(error.message || 'Erreur lors de l\'envoi de la preuve');
    } finally {
      setUploading(false);
    }
  };

  // Retourner au dashboard
  const handleGoToDashboard = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  };

  if (processing || uploading) {
    return <Loading message={processing ? "Création de votre facture..." : "Envoi de la preuve..."} />;
  }

  // Étape 1: Récapitulatif
  if (step === 'summary') {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Paiement</Text>
            <Text style={styles.headerSubtitle}>Récapitulatif de votre demande</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Récapitulatif */}
          <View style={styles.card}>
            <View style={styles.cardAccent} />
            <Text style={styles.cardTitle}>Votre demande</Text>

            <InfoRow icon="document-text" label="Document" value={documentConfig.name} />
            <InfoRow icon="location" label="Ville" value={requestData.city} />
            <InfoRow
              icon="business"
              label="Service"
              value={requestData.service_type === 'mairie' ? 'Mairie' : 'Sous-préfecture'}
            />
            <InfoRow
              icon="copy"
              label="Copies"
              value={`${requestData.copies} copie${requestData.copies > 1 ? 's' : ''}`}
            />
          </View>

          {/* Total */}
          <View style={styles.totalCard}>
            <View style={styles.totalCardAccent} />
            <Text style={styles.totalLabel}>Total à payer</Text>
            <Text style={styles.totalValue}>{requestData.total_amount.toLocaleString()} FCFA</Text>
          </View>

          {/* Mode de paiement */}
          <View style={styles.card}>
            <View style={styles.cardAccent} />
            <Text style={styles.cardTitle}>Mode de paiement</Text>

            <View style={styles.waveInfo}>
              <View style={styles.waveIconContainer}>
                <Ionicons name="phone-portrait" size={32} color="#1BA1E2" />
              </View>
              <View style={styles.waveTextContainer}>
                <Text style={styles.waveName}>Wave</Text>
                <Text style={styles.waveDescription}>
                  Paiement rapide et sécurisé via Wave
                </Text>
              </View>
            </View>

            <View style={styles.instructionBox}>
              <Ionicons name="information-circle" size={20} color="#047857" />
              <Text style={styles.instructionText}>
                En cliquant sur "Payer maintenant", l'application Wave s'ouvrira avec le montant pré-rempli.
              </Text>
            </View>
          </View>

          {/* Bouton Continuer */}
          <TouchableOpacity style={styles.primaryButton} onPress={handleCreateInvoice}>
            <Ionicons name="arrow-forward" size={20} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Continuer</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Étape 2: Paiement Wave
  if (step === 'payment') {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Payer avec Wave</Text>
            <Text style={styles.headerSubtitle}>Cliquez pour ouvrir Wave</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Facture créée */}
          <View style={styles.successCard}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={48} color="#10b981" />
            </View>
            <Text style={styles.successTitle}>Facture créée !</Text>
            <Text style={styles.successSubtitle}>
              Référence: <Text style={styles.reference}>{invoice?.reference}</Text>
            </Text>
          </View>

          {/* Montant */}
          <View style={styles.totalCard}>
            <View style={styles.totalCardAccent} />
            <Text style={styles.totalLabel}>Montant à payer</Text>
            <Text style={styles.totalValue}>{invoice?.amount.toLocaleString()} FCFA</Text>
          </View>

          {/* Instructions */}
          <View style={styles.card}>
            <View style={styles.cardAccent} />
            <Text style={styles.cardTitle}>Comment payer ?</Text>

            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Cliquez sur "Payer maintenant"</Text>
                <Text style={styles.stepDescription}>
                  L'application Wave s'ouvrira automatiquement avec le montant pré-rempli
                </Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Confirmez le paiement dans Wave</Text>
                <Text style={styles.stepDescription}>
                  Vérifiez le montant et validez le paiement
                </Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Faites une capture d'écran</Text>
                <Text style={styles.stepDescription}>
                  Après le paiement, faites une capture d'écran de la confirmation
                </Text>
              </View>
            </View>
          </View>

          {/* Bouton Wave */}
          <TouchableOpacity style={styles.waveButton} onPress={handleOpenWave}>
            <Ionicons name="wallet" size={24} color="#ffffff" />
            <Text style={styles.waveButtonText}>Payer maintenant avec Wave</Text>
          </TouchableOpacity>

          {/* Bouton passer à la confirmation */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setStep('confirmation')}
          >
            <Ionicons name="camera" size={18} color="#047857" />
            <Text style={styles.secondaryButtonText}>J'ai déjà payé - Ajouter la preuve</Text>
          </TouchableOpacity>

          {/* Expiration */}
          <View style={styles.expirationNote}>
            <Ionicons name="time-outline" size={16} color="#d97706" />
            <Text style={styles.expirationText}>
              Cette facture expire dans 24h. Passé ce délai, vous devrez refaire une demande.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Étape 3: Confirmation avec capture d'écran
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setStep('payment')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Confirmer le paiement</Text>
          <Text style={styles.headerSubtitle}>Ajoutez votre preuve de paiement</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Montant payé */}
        <View style={styles.totalCard}>
          <View style={styles.totalCardAccent} />
          <Text style={styles.totalLabel}>Montant payé</Text>
          <Text style={styles.totalValue}>{invoice?.amount.toLocaleString()} FCFA</Text>
          <Text style={styles.referenceSmall}>Réf: {invoice?.reference}</Text>
        </View>

        {/* Zone d'upload */}
        <View style={styles.card}>
          <View style={styles.cardAccent} />
          <Text style={styles.cardTitle}>Capture d'écran du paiement</Text>
          <Text style={styles.uploadDescription}>
            Ajoutez une capture d'écran de la confirmation de paiement Wave
          </Text>

          {proofImage ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: proofImage }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => setProofImage(null)}
              >
                <Ionicons name="close-circle" size={28} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.uploadButtons}>
              <TouchableOpacity style={styles.uploadButton} onPress={handleSelectProofImage}>
                <Ionicons name="image" size={32} color="#047857" />
                <Text style={styles.uploadButtonText}>Galerie</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadButton} onPress={handleTakePhoto}>
                <Ionicons name="camera" size={32} color="#047857" />
                <Text style={styles.uploadButtonText}>Photo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.instructionBox}>
          <Ionicons name="shield-checkmark" size={20} color="#047857" />
          <Text style={styles.instructionText}>
            Votre preuve sera vérifiée par notre équipe. Vous recevrez une confirmation dès que votre paiement sera validé.
          </Text>
        </View>

        {/* Bouton Soumettre */}
        <TouchableOpacity
          style={[styles.primaryButton, !proofImage && styles.primaryButtonDisabled]}
          onPress={handleSubmitProof}
          disabled={!proofImage}
        >
          <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
          <Text style={styles.primaryButtonText}>Envoyer la preuve de paiement</Text>
        </TouchableOpacity>

        {/* Bouton retour dashboard */}
        <TouchableOpacity style={styles.tertiaryButton} onPress={handleGoToDashboard}>
          <Text style={styles.tertiaryButtonText}>Je ferai ça plus tard</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabel}>
        <Ionicons name={icon as any} size={18} color="#6b7280" />
        <Text style={styles.infoLabelText}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
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
    paddingBottom: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#047857',
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
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    marginTop: 3,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: '#047857',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#047857',
    marginTop: 4,
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabelText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  totalCard: {
    backgroundColor: '#d1fae5',
    borderRadius: 18,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#6ee7b7',
    overflow: 'hidden',
  },
  totalCardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: '#d4af37',
  },
  totalLabel: {
    fontSize: 15,
    color: '#065f46',
    fontWeight: '600',
    marginBottom: 8,
  },
  totalValue: {
    fontSize: 32,
    color: '#047857',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  referenceSmall: {
    fontSize: 12,
    color: '#065f46',
    marginTop: 8,
    fontWeight: '500',
  },
  waveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#7dd3fc',
  },
  waveIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  waveTextContainer: {
    flex: 1,
  },
  waveName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0369a1',
    marginBottom: 2,
  },
  waveDescription: {
    fontSize: 13,
    color: '#0284c7',
    fontWeight: '500',
  },
  instructionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
    marginBottom: 16,
  },
  instructionText: {
    flex: 1,
    fontSize: 13,
    color: '#065f46',
    lineHeight: 20,
    fontWeight: '500',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#047857',
    borderRadius: 16,
    padding: 18,
    gap: 10,
    elevation: 6,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    borderWidth: 2,
    borderColor: '#d4af37',
    marginBottom: 12,
  },
  primaryButtonDisabled: {
    backgroundColor: '#9ca3af',
    borderColor: '#d1d5db',
    elevation: 0,
    shadowOpacity: 0,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  // Étape 2 styles
  successCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 28,
    marginBottom: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 2,
    borderColor: '#a7f3d0',
  },
  successIconContainer: {
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#047857',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  reference: {
    fontWeight: '800',
    color: '#047857',
    fontSize: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  stepNumberText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 19,
  },
  waveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1BA1E2',
    borderRadius: 16,
    padding: 18,
    gap: 12,
    marginBottom: 12,
    elevation: 6,
    shadowColor: '#1BA1E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  waveButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  expirationNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  expirationText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    lineHeight: 18,
    fontWeight: '500',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    gap: 8,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#d1fae5',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#047857',
  },
  tertiaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  tertiaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    textDecorationLine: 'underline',
  },
  // Upload styles
  uploadDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  uploadButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: '#a7f3d0',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#047857',
    marginTop: 8,
  },
  imagePreviewContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  removeImageButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#ffffff',
    borderRadius: 14,
  },
});
