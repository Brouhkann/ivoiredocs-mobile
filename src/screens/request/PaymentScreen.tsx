import React, { useState, useEffect } from 'react';
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

// Lien Wave de paiement
const WAVE_PAYMENT_BASE_URL = 'https://pay.wave.com/m/M_ci_i7JxKIwiaf99/c/ci/?amount=';

export default function PaymentScreen({ route, navigation }: any) {
  const { requestData } = route.params;
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);

  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [step, setStep] = useState<'payment' | 'confirmation'>('payment');
  const [proofImage, setProofImage] = useState<string | null>(null);

  const documentConfig = DOCUMENT_CONFIGS[requestData.document_type];

  // Créer la facture au chargement
  useEffect(() => {
    createInvoiceOnLoad();
  }, []);

  const createInvoiceOnLoad = async () => {
    if (!user?.id || invoice) return;

    try {
      setLoading(true);
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

      if (result.success && result.invoice) {
        setInvoice(result.invoice);
      }
    } catch (error) {
      console.error('Erreur création facture:', error);
    } finally {
      setLoading(false);
    }
  };

  // Ouvrir Wave pour le paiement
  const handlePayWithWave = async () => {
    const amount = invoice?.amount || requestData.total_amount;
    const waveLink = `${WAVE_PAYMENT_BASE_URL}${amount}`;

    try {
      await Linking.openURL(waveLink);
      // Passer à la confirmation après 1.5s
      setTimeout(() => setStep('confirmation'), 1500);
    } catch (error) {
      console.error('Erreur ouverture Wave:', error);
      toast.error("Impossible d'ouvrir Wave");
    }
  };

  // Sélectionner depuis la galerie
  const handleSelectImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Permission requise pour la galerie');
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
        toast.error('Permission requise pour la caméra');
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
    if (!proofImage || !invoice) {
      toast.error('Ajoutez une capture d\'écran');
      return;
    }

    try {
      setLoading(true);

      // Upload vers Supabase
      const fileName = `payment_proofs/${invoice.id}_${Date.now()}.jpg`;
      const response = await fetch(proofImage);
      const blob = await response.blob();

      const { data: uploadData } = await supabase.storage
        .from('documents')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

      // Mettre à jour la facture
      await supabase
        .from('invoices')
        .update({
          payment_proof_url: uploadData?.path || proofImage,
          status: 'pending_verification',
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);

      toast.success('Preuve envoyée ! Vérification en cours.');

      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } catch (error: any) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading message="Chargement..." />;
  }

  // ==================== PAGE 1: PAIEMENT ====================
  if (step === 'payment') {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Paiement</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Montant principal */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Montant à payer</Text>
            <Text style={styles.amountValue}>
              {requestData.total_amount.toLocaleString()} <Text style={styles.currency}>FCFA</Text>
            </Text>
            {invoice && (
              <Text style={styles.reference}>Réf: {invoice.reference}</Text>
            )}
          </View>

          {/* Récap compact */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Ionicons name="document-text" size={18} color="#047857" />
              <Text style={styles.summaryText}>{documentConfig.name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Ionicons name="location" size={18} color="#047857" />
              <Text style={styles.summaryText}>
                {requestData.city} • {requestData.service_type === 'mairie' ? 'Mairie' : 'Sous-préfecture'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Ionicons name="copy" size={18} color="#047857" />
              <Text style={styles.summaryText}>
                {requestData.copies} copie{requestData.copies > 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* Image Wave - Moyen de paiement */}
          <View style={styles.waveImageContainer}>
            <Image
              source={require('../../../assets/wave-button.png')}
              style={styles.waveImage}
              resizeMode="contain"
            />
          </View>

          {/* Instructions courtes */}
          <View style={styles.instructionCard}>
            <View style={styles.instructionStep}>
              <View style={styles.stepBadge}><Text style={styles.stepNum}>1</Text></View>
              <Text style={styles.stepText}>Cliquez sur "Payer"</Text>
            </View>
            <View style={styles.instructionStep}>
              <View style={styles.stepBadge}><Text style={styles.stepNum}>2</Text></View>
              <Text style={styles.stepText}>Confirmez le paiement dans Wave</Text>
            </View>
            <View style={styles.instructionStep}>
              <View style={styles.stepBadge}><Text style={styles.stepNum}>3</Text></View>
              <Text style={styles.stepText}>Envoyez la capture d'écran</Text>
            </View>
          </View>

          {/* Bouton Payer */}
          <TouchableOpacity style={styles.payBtn} onPress={handlePayWithWave}>
            <Ionicons name="wallet-outline" size={22} color="#fff" />
            <Text style={styles.payBtnText}>Payer</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ==================== PAGE 2: CONFIRMATION ====================
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setStep('payment')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirmation</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Succès */}
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={40} color="#10b981" />
          <Text style={styles.successText}>Paiement effectué ?</Text>
          <Text style={styles.successSubtext}>
            Ajoutez une capture d'écran pour valider
          </Text>
        </View>

        {/* Zone upload */}
        <View style={styles.uploadCard}>
          <Text style={styles.uploadTitle}>Capture d'écran du paiement</Text>

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
                <Ionicons name="images" size={36} color="#047857" />
                <Text style={styles.uploadBtnLabel}>Galerie</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadBtn} onPress={handleTakePhoto}>
                <Ionicons name="camera" size={36} color="#047857" />
                <Text style={styles.uploadBtnLabel}>Caméra</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark" size={18} color="#047857" />
          <Text style={styles.infoText}>
            Votre preuve sera vérifiée rapidement. Vous recevrez une notification dès validation.
          </Text>
        </View>

        {/* Bouton soumettre */}
        <TouchableOpacity
          style={[styles.submitBtn, !proofImage && styles.submitBtnDisabled]}
          onPress={handleSubmitProof}
          disabled={!proofImage}
        >
          <Ionicons name="send" size={20} color="#fff" />
          <Text style={styles.submitBtnText}>Envoyer la preuve</Text>
        </TouchableOpacity>

        {/* Lien retour */}
        <TouchableOpacity
          style={styles.laterBtn}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] })}
        >
          <Text style={styles.laterBtnText}>Je ferai ça plus tard</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0fdf4',
  },

  // Header
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

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  // Page 1 - Paiement
  amountCard: {
    backgroundColor: '#047857',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 20,
  },
  amountLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  amountValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '900',
  },
  currency: {
    fontSize: 20,
    fontWeight: '600',
  },
  reference: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 10,
  },

  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },

  instructionCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    gap: 14,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNum: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  stepText: {
    fontSize: 14,
    color: '#065f46',
    fontWeight: '500',
  },

  waveImageContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  waveImage: {
    width: '100%',
    height: 80,
  },

  payBtn: {
    backgroundColor: '#047857',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    elevation: 4,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  // Page 2 - Confirmation
  successBanner: {
    backgroundColor: '#d1fae5',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#6ee7b7',
  },
  successText: {
    color: '#047857',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 10,
  },
  successSubtext: {
    color: '#065f46',
    fontSize: 14,
    marginTop: 6,
  },

  uploadCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  uploadBtns: {
    flexDirection: 'row',
    gap: 16,
  },
  uploadBtn: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#a7f3d0',
    borderStyle: 'dashed',
  },
  uploadBtnLabel: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
  },

  previewContainer: {
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 280,
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

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    color: '#065f46',
    fontSize: 13,
    lineHeight: 19,
  },

  submitBtn: {
    backgroundColor: '#047857',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  submitBtnDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  laterBtn: {
    alignItems: 'center',
    padding: 12,
  },
  laterBtnText: {
    color: '#6b7280',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
