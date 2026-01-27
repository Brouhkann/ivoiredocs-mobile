import { supabase } from '../config/supabase';
import { Linking } from 'react-native';
import { assignDelegateToRequest } from './delegateAssignmentService';

/**
 * Service de paiement Wave (manuel avec liens WhatsApp)
 *
 * Workflow:
 * 1. Utilisateur soumet une demande → status: pending_payment
 * 2. Une facture est créée avec un numéro de référence unique
 * 3. L'utilisateur contacte l'admin via WhatsApp pour recevoir le lien Wave
 * 4. L'admin confirme le paiement dans le dashboard
 * 5. La demande passe en status: new et est assignée à un délégué
 */

// Numéro WhatsApp de l'admin pour les paiements
export const WAVE_ADMIN_PHONE = '2250545703076';

export interface Invoice {
  id: string;
  reference: string;
  user_id: string;
  request_id: string | null;
  amount: number;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  payment_method: 'wave' | null;
  wave_transaction_id: string | null;
  created_at: string;
  paid_at: string | null;
  expires_at: string;
  metadata: {
    document_type: string;
    city: string;
    service_type: string;
    copies: number;
    customer_name: string;
    customer_phone: string;
    billing_details?: any;
  };
}

/**
 * Génère une référence de facture unique
 * Format: IV-YYYYMMDD-XXXX (ex: IV-20240124-A7B3)
 */
export function generateInvoiceReference(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `IV-${dateStr}-${random}`;
}

/**
 * Crée une facture pour une demande en attente de paiement
 */
export async function createInvoice(data: {
  user_id: string;
  amount: number;
  document_type: string;
  city: string;
  service_type: string;
  copies: number;
  customer_name: string;
  customer_phone: string;
  billing_details?: any;
  request_data: any; // Données complètes de la demande pour créer la request après paiement
}): Promise<{ success: boolean; invoice?: Invoice; error?: string }> {
  try {
    const reference = generateInvoiceReference();

    // La facture expire après 24h
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        reference,
        user_id: data.user_id,
        request_id: null, // Sera mis à jour après création de la demande
        amount: data.amount,
        status: 'pending',
        payment_method: null,
        wave_transaction_id: null,
        expires_at: expiresAt.toISOString(),
        metadata: {
          document_type: data.document_type,
          city: data.city,
          service_type: data.service_type,
          copies: data.copies,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          billing_details: data.billing_details,
          request_data: data.request_data,
        },
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, invoice };
  } catch (error: any) {
    console.error('Erreur création facture:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Récupère une facture par sa référence
 */
export async function getInvoiceByReference(reference: string): Promise<Invoice | null> {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('reference', reference)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur récupération facture:', error);
    return null;
  }
}

/**
 * Récupère les factures d'un utilisateur
 */
export async function getUserInvoices(userId: string): Promise<Invoice[]> {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erreur récupération factures:', error);
    return [];
  }
}

/**
 * Récupère les factures en attente de paiement (pour l'admin)
 */
export async function getPendingInvoices(): Promise<Invoice[]> {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erreur récupération factures en attente:', error);
    return [];
  }
}

/**
 * Confirme le paiement d'une facture (appelé par l'admin)
 */
export async function confirmPayment(
  invoiceId: string,
  waveTransactionId?: string
): Promise<{ success: boolean; request_id?: string; delegate_assigned?: boolean; delegate_id?: string; error?: string }> {
  try {
    // 1. Récupérer la facture
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (fetchError || !invoice) {
      throw new Error('Facture non trouvée');
    }

    if (invoice.status !== 'pending') {
      throw new Error('Cette facture a déjà été traitée');
    }

    // 2. Créer la demande avec les données sauvegardées
    const requestData = invoice.metadata.request_data;

    const { data: request, error: requestError } = await supabase
      .from('requests')
      .insert({
        user_id: invoice.user_id,
        document_type: requestData.document_type,
        service_type: requestData.service_type,
        city: requestData.city,
        copies: requestData.copies,
        total_amount: invoice.amount,
        delegate_earnings: requestData.delegate_earnings,
        form_data: requestData.form_data,
        status: 'new',
        payment_method: 'wave',
        payment_transaction_id: waveTransactionId || invoice.reference,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (requestError) throw requestError;

    // 3. Mettre à jour la facture
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'paid',
        payment_method: 'wave',
        wave_transaction_id: waveTransactionId || null,
        paid_at: new Date().toISOString(),
        request_id: request.id,
      })
      .eq('id', invoiceId);

    if (updateError) throw updateError;

    // 4. Assigner automatiquement un délégué à la demande
    console.log('🎯 Assignation automatique du délégué...');
    const assignmentResult = await assignDelegateToRequest(request.id);

    if (assignmentResult.success) {
      console.log('✅ Délégué assigné avec succès:', assignmentResult.delegateId);
    } else {
      // L'assignation a échoué mais le paiement est confirmé
      // La demande reste en status 'new' et pourra être assignée manuellement
      console.warn('⚠️ Assignation délégué échouée:', assignmentResult.error);
    }

    return {
      success: true,
      request_id: request.id,
      delegate_assigned: assignmentResult.success,
      delegate_id: assignmentResult.delegateId
    };
  } catch (error: any) {
    console.error('Erreur confirmation paiement:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Annule une facture
 */
export async function cancelInvoice(invoiceId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'cancelled' })
      .eq('id', invoiceId);

    return !error;
  } catch (error) {
    console.error('Erreur annulation facture:', error);
    return false;
  }
}

/**
 * Génère le message WhatsApp pour demander le lien de paiement
 */
export function generatePaymentRequestMessage(invoice: Invoice): string {
  const message = `🧾 *DEMANDE DE PAIEMENT IVOIREDOCS*

📋 *Référence:* ${invoice.reference}
💰 *Montant:* ${invoice.amount.toLocaleString()} FCFA

📄 *Document:* ${invoice.metadata.document_type}
🏙️ *Ville:* ${invoice.metadata.city}
📑 *Copies:* ${invoice.metadata.copies}

👤 *Client:* ${invoice.metadata.customer_name}
📱 *Téléphone:* ${invoice.metadata.customer_phone}

Bonjour, je souhaite recevoir mon lien de paiement Wave pour cette demande. Merci !`;

  return message;
}

/**
 * Ouvre WhatsApp pour contacter l'admin avec les détails de paiement
 */
export function openWhatsAppForPayment(invoice: Invoice): void {
  const message = encodeURIComponent(generatePaymentRequestMessage(invoice));
  const url = `https://wa.me/${WAVE_ADMIN_PHONE}?text=${message}`;
  Linking.openURL(url);
}

/**
 * Génère le message WhatsApp que l'admin envoie au client avec le lien Wave
 * (Utile pour l'admin dashboard)
 */
export function generateAdminPaymentMessage(invoice: Invoice, waveLink: string): string {
  return `✅ *IVOIREDOCS - Lien de Paiement*

Bonjour ${invoice.metadata.customer_name},

Voici votre lien de paiement Wave pour votre demande :

📋 Référence: ${invoice.reference}
💰 Montant: ${invoice.amount.toLocaleString()} FCFA
📄 Document: ${invoice.metadata.document_type}

🔗 *Lien de paiement:*
${waveLink}

⏰ Ce lien expire dans 24h.

Après votre paiement, votre demande sera immédiatement transmise à notre équipe.

Merci de votre confiance !
L'équipe Ivoiredocs`;
}

/**
 * Ouvre WhatsApp pour que l'admin envoie le lien au client
 */
export function openWhatsAppToClient(
  customerPhone: string,
  invoice: Invoice,
  waveLink: string
): void {
  // Nettoyer le numéro de téléphone
  let phone = customerPhone.replace(/[\s\-\.\(\)]/g, '');
  if (phone.startsWith('0')) {
    phone = '225' + phone.substring(1);
  } else if (!phone.startsWith('225') && !phone.startsWith('+225')) {
    phone = '225' + phone;
  }
  phone = phone.replace('+', '');

  const message = encodeURIComponent(generateAdminPaymentMessage(invoice, waveLink));
  const url = `https://wa.me/${phone}?text=${message}`;
  Linking.openURL(url);
}
