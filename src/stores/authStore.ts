import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../config/supabase";
import type { User as AppUser, UserRole } from "../types";
import { phoneToFakeEmail, normalizePhone } from "../utils/phoneValidation";

// Erreurs personnalisées pour l'authentification
export class AuthError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'AuthError';
  }
}

export const AUTH_ERROR_CODES = {
  INVALID_PHONE: 'INVALID_PHONE',
  PHONE_NOT_REGISTERED: 'PHONE_NOT_REGISTERED',
  WRONG_PASSWORD: 'WRONG_PASSWORD',
  PHONE_ALREADY_REGISTERED: 'PHONE_ALREADY_REGISTERED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

// Fonction helper pour détecter les erreurs réseau
function isNetworkError(error: any): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('unable to resolve') ||
    error.code === 'ECONNABORTED' ||
    error.code === 'ENOTFOUND'
  );
}

interface AuthState {
  user: User | null;
  profile: AppUser | null;
  loading: boolean;
  checkPhoneExists: (phone: string) => Promise<boolean>;
  signIn: (phone: string, password: string) => Promise<void>;
  signUp: (
    phone: string,
    password: string,
    name: string,
    role?: UserRole,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  updateProfile: (profile: Partial<AppUser>) => Promise<void>;
  isAdmin: () => boolean;
  isDelegate: () => boolean;
  isDriver: () => boolean;
  isUser: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,

  checkPhoneExists: async (phone: string): Promise<boolean> => {
    try {
      const normalizedPhone = normalizePhone(phone);

      // Vérifier si un utilisateur existe avec ce numéro de téléphone
      const { data, error } = await supabase
        .from("users")
        .select("id")
        .eq("phone", normalizedPhone)
        .maybeSingle();

      if (error) {
        console.error("Erreur vérification téléphone:", error);
        if (isNetworkError(error)) {
          throw new AuthError(
            "Erreur de connexion internet. Vérifiez votre connexion et réessayez.",
            AUTH_ERROR_CODES.NETWORK_ERROR
          );
        }
        return false;
      }

      return data !== null;
    } catch (error: any) {
      console.error("Erreur vérification téléphone:", error);
      if (error instanceof AuthError) throw error;
      if (isNetworkError(error)) {
        throw new AuthError(
          "Erreur de connexion internet. Vérifiez votre connexion et réessayez.",
          AUTH_ERROR_CODES.NETWORK_ERROR
        );
      }
      return false;
    }
  },

  signIn: async (phone: string, password: string) => {
    // Normaliser le téléphone et générer l'email fictif
    const normalizedPhone = normalizePhone(phone);
    const fakeEmail = phoneToFakeEmail(normalizedPhone);

    // Vérifier d'abord si le numéro est enregistré
    const phoneExists = await get().checkPhoneExists(phone);

    if (!phoneExists) {
      throw new AuthError(
        "Ce numéro de téléphone n'est pas encore enregistré",
        AUTH_ERROR_CODES.PHONE_NOT_REGISTERED
      );
    }

    // Tenter la connexion
    const { data, error } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password,
    });

    if (error) {
      // Si le numéro existe mais erreur de connexion, c'est le mot de passe
      if (error.message?.includes('Invalid login credentials')) {
        throw new AuthError(
          "Mot de passe incorrect",
          AUTH_ERROR_CODES.WRONG_PASSWORD
        );
      }
      if (isNetworkError(error)) {
        throw new AuthError(
          "Erreur de connexion internet. Vérifiez votre connexion et réessayez.",
          AUTH_ERROR_CODES.NETWORK_ERROR
        );
      }
      throw new AuthError(
        "Erreur de connexion. Veuillez réessayer.",
        AUTH_ERROR_CODES.UNKNOWN_ERROR
      );
    }

    if (data.user) {
      // Récupérer le profil utilisateur
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (profileError) {
        throw new AuthError(
          "Erreur lors de la récupération du profil",
          AUTH_ERROR_CODES.UNKNOWN_ERROR
        );
      }

      set({ user: data.user, profile, loading: false });
    }
  },

  signUp: async (
    phone: string,
    password: string,
    name: string,
    role: UserRole = "user",
  ) => {
    // Normaliser le téléphone et générer l'email fictif
    const normalizedPhone = normalizePhone(phone);
    const fakeEmail = phoneToFakeEmail(normalizedPhone);

    // Vérifier d'abord si le numéro est déjà enregistré
    const phoneExists = await get().checkPhoneExists(phone);

    if (phoneExists) {
      throw new AuthError(
        "Ce numéro de téléphone est déjà enregistré. Veuillez vous connecter.",
        AUTH_ERROR_CODES.PHONE_ALREADY_REGISTERED
      );
    }

    const { data, error } = await supabase.auth.signUp({
      email: fakeEmail,
      password,
      options: {
        data: {
          name,
          phone: normalizedPhone,
          role,
        },
      },
    });

    if (error) {
      if (error.message?.includes('already registered')) {
        throw new AuthError(
          "Ce numéro de téléphone est déjà enregistré. Veuillez vous connecter.",
          AUTH_ERROR_CODES.PHONE_ALREADY_REGISTERED
        );
      }
      if (isNetworkError(error)) {
        throw new AuthError(
          "Erreur de connexion internet. Vérifiez votre connexion et réessayez.",
          AUTH_ERROR_CODES.NETWORK_ERROR
        );
      }
      throw new AuthError(
        "Erreur d'inscription. Veuillez réessayer.",
        AUTH_ERROR_CODES.UNKNOWN_ERROR
      );
    }

    if (data.user) {
      // Créer le profil utilisateur
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .insert({
          id: data.user.id,
          email: fakeEmail,
          name,
          phone: normalizedPhone,
          role,
          preferences: {
            notifications: true,
            default_city: "",
            preferred_shipping: "standard",
          },
        })
        .select()
        .single();

      if (profileError) {
        throw new AuthError(
          "Erreur lors de la création du profil",
          AUTH_ERROR_CODES.UNKNOWN_ERROR
        );
      }

      set({ user: data.user, profile, loading: false });
    }
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      set({ user: null, profile: null, loading: false });
    } catch (error) {
      console.error("Erreur de déconnexion:", error);
      throw error;
    }
  },

  initializeAuth: async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Récupérer le profil utilisateur
        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error(
            "Erreur lors de la récupération du profil:",
            profileError,
          );
        }

        set({ user, profile, loading: false });
      } else {
        set({ user: null, profile: null, loading: false });
      }
    } catch (error) {
      console.error("Erreur d'initialisation auth:", error);
      set({ loading: false });
    }
  },

  updateProfile: async (updatedProfile: Partial<AppUser>) => {
    try {
      const { profile } = get();
      if (!profile) throw new Error("Aucun profil utilisateur");

      const { data, error } = await supabase
        .from("users")
        .update(updatedProfile)
        .eq("id", profile.id)
        .select()
        .single();

      if (error) throw error;

      set({ profile: data });
    } catch (error) {
      console.error("Erreur de mise à jour du profil:", error);
      throw error;
    }
  },

  isAdmin: () => {
    const { profile } = get();
    return profile?.role === "admin";
  },

  isDelegate: () => {
    const { profile } = get();
    return profile?.role === "delegate";
  },

  isDriver: () => {
    const { profile } = get();
    return profile?.role === "driver";
  },

  isUser: () => {
    const { profile } = get();
    return profile?.role === "user" || !profile?.role;
  },
}));

// Écouter les changements d'authentification
supabase.auth.onAuthStateChange((event, session) => {
  const { initializeAuth } = useAuthStore.getState();

  if (event === "SIGNED_OUT" || !session) {
    useAuthStore.setState({ user: null, profile: null, loading: false });
  } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
    initializeAuth();
  }
});
