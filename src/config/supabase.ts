import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Récupération des variables d'environnement avec trim pour éviter les espaces
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

// Debug détaillé en mode développement
if (__DEV__) {
  console.log("🔍 Debug Supabase Config:");
  console.log("process.env keys:", Object.keys(process.env).filter(k => k.startsWith('EXPO')));
  console.log("URL:", supabaseUrl ? "✓ Loaded" : "✗ Missing");
  console.log("URL Value:", supabaseUrl);
  console.log("Key:", supabaseAnonKey ? "✓ Loaded" : "✗ Missing");
  console.log("Key Length:", supabaseAnonKey?.length || 0);
  if (supabaseAnonKey) {
    console.log("Key Preview:", `${supabaseAnonKey.substring(0, 20)}...${supabaseAnonKey.substring(supabaseAnonKey.length - 20)}`);
  }
}

// Vérification stricte des variables d'environnement
if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = "⚠️ ERREUR CRITIQUE: Variables Supabase manquantes!";
  console.error(errorMsg);
  console.error("URL présente:", !!supabaseUrl);
  console.error("Key présente:", !!supabaseAnonKey);
  console.error("");
  console.error("📝 Solution:");
  console.error("1. Vérifiez que le fichier .env existe à la racine du projet");
  console.error("2. Vérifiez qu'il contient:");
  console.error("   EXPO_PUBLIC_SUPABASE_URL=votre_url");
  console.error("   EXPO_PUBLIC_SUPABASE_ANON_KEY=votre_cle");
  console.error("3. Redémarrez le serveur Metro: npx expo start -c");
  console.error("");
}

// Utiliser les valeurs directement sans fallback
const finalUrl = supabaseUrl || "https://placeholder.supabase.co";
const finalKey = supabaseAnonKey || "placeholder-key";

// Vérification de la validité de l'URL
try {
  new URL(finalUrl);
  if (__DEV__ && supabaseUrl) {
    console.log("✅ URL Supabase valide");
  }
} catch (e) {
  console.error("❌ URL Supabase invalide:", finalUrl);
}

// Configuration du client Supabase avec AsyncStorage
export const supabase = createClient(finalUrl, finalKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Log de confirmation en dev
if (__DEV__) {
  console.log("✅ Client Supabase initialisé");
}

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
