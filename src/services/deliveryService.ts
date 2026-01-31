import { supabase } from '../config/supabase';
import type { DeliverySector, DeliveryPricingConfig } from '../types';

/** Coordonnees GPS de la gare routiere d'Adjame (point de depot pour expeditions vers l'interieur) */
export const GARE_ADJAME = { latitude: 5.3364, longitude: -4.0267 };

/**
 * Distance Haversine entre 2 points GPS (en km)
 */
export function getDistanceKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calcul du prix de livraison express avec la formule GPS automatique
 * prix = base_fee + (distance_km x per_km_rate x road_factor), arrondi au rounding superieur, borne min/max
 */
export function calculateExpressPriceFromCoords(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  config: DeliveryPricingConfig
): { price: number; distanceKm: number; roadDistanceKm: number } {
  const distanceKm = getDistanceKm(lat1, lon1, lat2, lon2);
  const roadDistanceKm = distanceKm * config.road_factor;
  const rawPrice = config.base_fee + (roadDistanceKm * config.per_km_rate);

  // Arrondi au rounding superieur
  let price = Math.ceil(rawPrice / config.rounding) * config.rounding;

  // Borner entre min et max
  price = Math.max(config.min_price, Math.min(config.max_price, price));

  return { price, distanceKm: Math.round(distanceKm * 10) / 10, roadDistanceKm: Math.round(roadDistanceKm * 10) / 10 };
}

/**
 * Recuperer les coordonnees GPS de la mairie d'une commune
 */
export async function getCommunePickupPoint(commune: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const { data, error } = await supabase
      .from('commune_pickup_points')
      .select('latitude, longitude')
      .ilike('commune', commune)
      .single();

    if (error || !data) return null;
    return { latitude: Number(data.latitude), longitude: Number(data.longitude) };
  } catch {
    return null;
  }
}

/**
 * Calcul du prix express a partir d'un secteur de pickup (ou de la ville par defaut) et d'un secteur de livraison
 * Si pickupSectorOrCity est un string (nom de commune), on cherche les coordonnees GPS de sa mairie
 */
export async function calculateExpressPrice(
  pickupSectorOrCity: { latitude: number; longitude: number } | string,
  deliverySector: DeliverySector
): Promise<{ price: number; distanceKm: number; roadDistanceKm: number } | null> {
  try {
    // Charger la config tarifaire
    const { data: config, error: configError } = await supabase
      .from('delivery_pricing_config')
      .select('*')
      .limit(1)
      .single();

    if (configError || !config) {
      console.error('Erreur chargement config tarification:', configError);
      return null;
    }

    let pickupLat: number;
    let pickupLon: number;

    if (typeof pickupSectorOrCity === 'string') {
      // Chercher les coordonnees GPS de la mairie de la commune d'etablissement
      const pickupPoint = await getCommunePickupPoint(pickupSectorOrCity);
      if (pickupPoint) {
        pickupLat = pickupPoint.latitude;
        pickupLon = pickupPoint.longitude;
      } else {
        // Fallback: centre de Plateau
        pickupLat = 5.3200;
        pickupLon = -4.0170;
      }
    } else {
      pickupLat = pickupSectorOrCity.latitude;
      pickupLon = pickupSectorOrCity.longitude;
    }

    return calculateExpressPriceFromCoords(
      pickupLat, pickupLon,
      deliverySector.latitude, deliverySector.longitude,
      config
    );
  } catch (error) {
    console.error('Erreur calcul prix express:', error);
    return null;
  }
}

/**
 * Calcul du prix de recuperation mairie → gare d'Adjame (obligatoire pour expeditions vers l'interieur)
 * Le livreur recupere le document a la mairie de la commune d'etablissement et le depose a la gare
 */
export async function calculatePickupToGarePrice(
  city: string
): Promise<{ price: number; distanceKm: number; roadDistanceKm: number } | null> {
  try {
    const { data: config, error: configError } = await supabase
      .from('delivery_pricing_config')
      .select('*')
      .limit(1)
      .single();

    if (configError || !config) {
      console.error('Erreur chargement config tarification:', configError);
      return null;
    }

    const pickupPoint = await getCommunePickupPoint(city);
    const pickupLat = pickupPoint?.latitude ?? 5.3200;
    const pickupLon = pickupPoint?.longitude ?? -4.0170;

    return calculateExpressPriceFromCoords(
      pickupLat, pickupLon,
      GARE_ADJAME.latitude, GARE_ADJAME.longitude,
      config
    );
  } catch (error) {
    console.error('Erreur calcul prix pickup vers gare:', error);
    return null;
  }
}

/**
 * Recuperer les secteurs actifs pour une commune
 */
export async function getSectorsForCommune(commune: string): Promise<DeliverySector[]> {
  try {
    const { data, error } = await supabase
      .from('delivery_sectors')
      .select('*')
      .ilike('commune', commune)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erreur chargement secteurs:', error);
    return [];
  }
}

/**
 * Verifier si la livraison express est disponible pour une commune
 */
export async function isExpressDeliveryAvailable(commune: string): Promise<boolean> {
  const sectors = await getSectorsForCommune(commune);
  return sectors.length > 0;
}

/**
 * Recuperer toutes les communes avec leurs secteurs actifs pour le dropdown client
 */
export async function getExpressCommunesWithSectors(): Promise<
  Array<{ commune: string; sectors: DeliverySector[] }>
> {
  try {
    const { data, error } = await supabase
      .from('delivery_sectors')
      .select('*')
      .eq('is_active', true)
      .order('commune', { ascending: true })
      .order('display_order', { ascending: true });

    if (error) throw error;

    // Grouper par commune
    const communeMap = new Map<string, DeliverySector[]>();
    for (const sector of data || []) {
      if (!communeMap.has(sector.commune)) {
        communeMap.set(sector.commune, []);
      }
      communeMap.get(sector.commune)!.push(sector);
    }

    return Array.from(communeMap.entries()).map(([commune, sectors]) => ({
      commune,
      sectors,
    }));
  } catch (error) {
    console.error('Erreur chargement communes avec secteurs:', error);
    return [];
  }
}

/**
 * Generer un code secret 4 chiffres aleatoire
 */
export function generateDeliveryCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Assigner un livreur a une demande
 */
export async function assignDriverToRequest(
  requestId: string,
  driverId: string
): Promise<void> {
  const { error } = await supabase
    .from('requests')
    .update({ driver_id: driverId })
    .eq('id', requestId);

  if (error) throw error;
}
