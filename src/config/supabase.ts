import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Configuration Supabase via variables d'environnement
// Les valeurs sont injectées au build time via le fichier .env
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("⚠️ SUPABASE_URL ou SUPABASE_ANON_KEY non configurés!");
}

// Debug en mode développement
if (__DEV__) {
  console.log("🔍 Supabase Config:");
  console.log("URL:", supabaseUrl);
  console.log("Key Length:", supabaseAnonKey.length);
}

// Configuration du client Supabase avec AsyncStorage
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Types Supabase générés automatiquement
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          phone: string;
          name: string;
          preferences: any;
          created_at: string;
          total_requests: number;
        };
        Insert: {
          id?: string;
          email: string;
          phone: string;
          name: string;
          preferences?: any;
          created_at?: string;
          total_requests?: number;
        };
        Update: {
          id?: string;
          email?: string;
          phone?: string;
          name?: string;
          preferences?: any;
          created_at?: string;
          total_requests?: number;
        };
      };
      delegates: {
        Row: {
          id: string;
          name: string;
          city: string;
          services: string[];
          is_active: boolean;
          rating: number;
          total_requests: number;
          total_earnings: number;
        };
        Insert: {
          id?: string;
          name: string;
          city: string;
          services: string[];
          is_active?: boolean;
          rating?: number;
          total_requests?: number;
          total_earnings?: number;
        };
        Update: {
          id?: string;
          name?: string;
          city?: string;
          services?: string[];
          is_active?: boolean;
          rating?: number;
          total_requests?: number;
          total_earnings?: number;
        };
      };
      requests: {
        Row: {
          id: string;
          user_id: string;
          delegate_id: string | null;
          document_type: string;
          service_type: string;
          status: string;
          city: string;
          copies: number;
          total_amount: number;
          delegate_earnings: number;
          created_at: string;
          estimated_completion: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          delegate_id?: string | null;
          document_type: string;
          service_type: string;
          status?: string;
          city: string;
          copies?: number;
          total_amount: number;
          delegate_earnings?: number;
          created_at?: string;
          estimated_completion?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          delegate_id?: string | null;
          document_type?: string;
          service_type?: string;
          status?: string;
          city?: string;
          copies?: number;
          total_amount?: number;
          delegate_earnings?: number;
          created_at?: string;
          estimated_completion?: string | null;
          completed_at?: string | null;
        };
      };
    };
  };
};
