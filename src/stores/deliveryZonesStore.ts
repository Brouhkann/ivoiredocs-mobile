import { create } from 'zustand';
import { supabase } from '../config/supabase';
import type { DeliveryZone, DeliverySector, DeliveryPricingConfig } from '../types';

interface DeliveryZonesState {
  zones: DeliveryZone[];
  sectors: DeliverySector[];
  pricingConfig: DeliveryPricingConfig | null;
  loading: boolean;
  loadZones: () => Promise<void>;
  loadSectors: (commune?: string) => Promise<void>;
  loadPricingConfig: () => Promise<void>;
  findZoneForCommune: (commune: string) => DeliveryZone | undefined;
}

export const useDeliveryZonesStore = create<DeliveryZonesState>((set, get) => ({
  zones: [],
  sectors: [],
  pricingConfig: null,
  loading: false,

  loadZones: async () => {
    try {
      set({ loading: true });
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      set({ zones: data || [] });
    } catch (error) {
      console.error('Erreur chargement zones:', error);
    } finally {
      set({ loading: false });
    }
  },

  loadSectors: async (commune?: string) => {
    try {
      set({ loading: true });
      let query = supabase
        .from('delivery_sectors')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (commune) {
        query = query.ilike('commune', commune);
      }

      const { data, error } = await query;
      if (error) throw error;
      set({ sectors: data || [] });
    } catch (error) {
      console.error('Erreur chargement secteurs:', error);
    } finally {
      set({ loading: false });
    }
  },

  loadPricingConfig: async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_pricing_config')
        .select('*')
        .limit(1)
        .single();

      if (error) throw error;
      set({ pricingConfig: data });
    } catch (error) {
      console.error('Erreur chargement config tarification:', error);
    }
  },

  findZoneForCommune: (commune: string) => {
    const { zones } = get();
    const communeLower = commune.toLowerCase().trim();
    return zones.find(z =>
      z.communes.some(c => c.toLowerCase() === communeLower)
    );
  },
}));
