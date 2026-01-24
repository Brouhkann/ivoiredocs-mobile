import { supabase } from '../config/supabase';

/**
 * Service pour tracker les villes recherchées mais non disponibles
 * Permet à l'admin de voir quelles villes sont demandées pour étendre le service
 */

export interface CitySearchLog {
  id: string;
  search_term: string;
  user_id: string | null;
  search_count: number;
  first_searched_at: string;
  last_searched_at: string;
}

export interface CitySearchStats {
  search_term: string;
  search_count: number;
  unique_users: number;
  last_searched_at: string;
}

/**
 * Enregistre une recherche de ville non trouvée
 */
export async function logCitySearch(searchTerm: string, userId?: string): Promise<void> {
  if (!searchTerm || searchTerm.trim().length < 2) return;

  const normalizedTerm = searchTerm.trim().toLowerCase();

  try {
    // Vérifier si cette ville a déjà été recherchée
    const { data: existing } = await supabase
      .from('city_search_logs')
      .select('id, search_count')
      .eq('search_term', normalizedTerm)
      .maybeSingle();

    if (existing) {
      // Mettre à jour le compteur
      await supabase
        .from('city_search_logs')
        .update({
          search_count: existing.search_count + 1,
          last_searched_at: new Date().toISOString(),
          last_user_id: userId || null,
        })
        .eq('id', existing.id);
    } else {
      // Créer une nouvelle entrée
      await supabase
        .from('city_search_logs')
        .insert({
          search_term: normalizedTerm,
          display_name: searchTerm.trim(), // Garder la casse originale pour l'affichage
          user_id: userId || null,
          last_user_id: userId || null,
          search_count: 1,
          first_searched_at: new Date().toISOString(),
          last_searched_at: new Date().toISOString(),
        });
    }
  } catch (error) {
    // Ne pas bloquer l'utilisateur si le log échoue
    console.error('Erreur lors du log de recherche ville:', error);
  }
}

/**
 * Récupère les statistiques des villes recherchées pour l'admin
 */
export async function getCitySearchStats(): Promise<{
  success: boolean;
  data: CitySearchStats[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('city_search_logs')
      .select('search_term, display_name, search_count, last_searched_at')
      .order('search_count', { ascending: false })
      .limit(20);

    if (error) throw error;

    return {
      success: true,
      data: (data || []).map(item => ({
        search_term: item.display_name || item.search_term,
        search_count: item.search_count,
        unique_users: 1, // Simplifié pour l'instant
        last_searched_at: item.last_searched_at,
      })),
    };
  } catch (error: any) {
    console.error('Erreur récupération stats recherche villes:', error);
    return {
      success: false,
      data: [],
      error: error.message,
    };
  }
}

/**
 * Supprime une entrée de recherche (quand la ville est ajoutée au service)
 */
export async function deleteCitySearchLog(searchTerm: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('city_search_logs')
      .delete()
      .eq('search_term', searchTerm.toLowerCase());

    return !error;
  } catch (error) {
    console.error('Erreur suppression log recherche ville:', error);
    return false;
  }
}

/**
 * Récupère le total des recherches non satisfaites
 */
export async function getTotalUnsatisfiedSearches(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('city_search_logs')
      .select('search_count');

    if (error) throw error;

    return (data || []).reduce((sum, item) => sum + item.search_count, 0);
  } catch (error) {
    console.error('Erreur comptage recherches:', error);
    return 0;
  }
}
