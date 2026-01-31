import { supabase } from '../config/supabase';
import type { Request, DocumentType } from '../types';

/**
 * Service pour gérer les demandes de documents
 * Version mobile adaptée du service web
 */

// Récupérer toutes les demandes d'un utilisateur
export async function getUserRequests(userId: string): Promise<Request[]> {
  try {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erreur récupération demandes:', error);
    throw error;
  }
}

// Récupérer une demande spécifique avec pièces jointes
export async function getRequest(requestId: string): Promise<Request | null> {
  try {
    // Récupérer la demande
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error) throw error;

    // Récupérer les pièces jointes associées
    const { data: attachments, error: attachmentsError } = await supabase
      .from('request_attachments')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });

    if (attachmentsError) {
      console.warn('Erreur récupération pièces jointes:', attachmentsError);
    }

    // Construire les URLs pour les pièces jointes depuis le bucket public "documents"
    const attachmentsWithUrls = (attachments || []).map((attachment: any) => {
      let fileUrl = attachment.file_url;

      // Si pas de file_url mais storage_path existe, construire l'URL publique
      if (!fileUrl && attachment.storage_path) {
        const fullPath = attachment.storage_path;
        const baseUrl = supabase.storage.from('documents').getPublicUrl('dummy').data.publicUrl;
        fileUrl = baseUrl.replace('/dummy', `/${fullPath}`);
        console.log('✅ URL publique construite:', fileUrl);
      }

      return {
        ...attachment,
        file_url: fileUrl,
      };
    });

    // Ajouter les pièces jointes à la demande
    return {
      ...data,
      attachments: attachmentsWithUrls,
    };
  } catch (error) {
    console.error('Erreur récupération demande:', error);
    throw error;
  }
}

// Récupérer les demandes d'un délégué
export async function getDelegateRequests(delegateId: string): Promise<Request[]> {
  try {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('delegate_id', delegateId)
      .in('status', ['assigned', 'in_progress', 'ready'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erreur récupération missions:', error);
    throw error;
  }
}

// Créer une nouvelle demande (version simplifiée pour MVP mobile)
export async function createRequest(requestData: {
  user_id: string;
  document_type: DocumentType;
  service_type: string;
  city: string;
  copies: number;
  total_amount: number;
  delegate_earnings: number;
  form_data: any;
  delegate_id?: string | null;
}): Promise<Request> {
  try {
    const { data, error } = await supabase
      .from('requests')
      .insert({
        ...requestData,
        status: 'new',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur création demande:', error);
    throw error;
  }
}

// Mettre à jour le statut d'une demande
export async function updateRequestStatus(
  requestId: string,
  status: Request['status'],
  additionalData?: Partial<Request>
): Promise<void> {
  try {
    const updateData: any = {
      status,
      ...additionalData,
    };

    // Ajouter les timestamps selon le statut
    if (status === 'assigned') {
      updateData.assigned_at = new Date().toISOString();
    } else if (status === 'in_progress') {
      updateData.started_at = new Date().toISOString();
    } else if (status === 'ready') {
      updateData.ready_at = new Date().toISOString();
    } else if (status === 'shipped') {
      updateData.shipped_at = new Date().toISOString();
    } else if (status === 'in_transit') {
      updateData.in_transit_at = new Date().toISOString();
    } else if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    } else if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('requests')
      .update(updateData)
      .eq('id', requestId);

    if (error) throw error;
  } catch (error) {
    console.error('Erreur mise à jour statut:', error);
    throw error;
  }
}
