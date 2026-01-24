import { supabase } from "../config/supabase";
import { NotificationService } from "./notifications";

// Types locaux pour éviter les conflits d'import
type ServiceType =
  | "mairie"
  | "sous_prefecture"
  | "justice"
  | "mairie/sous-préfecture";

export interface DelegateInfo {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  service_type: ServiceType; // UN service par délégué
  is_available: boolean;
  rating: number;
  total_completed: number;
}

/**
 * Trouver LE délégué spécifique pour une ville + service
 */
export async function findDelegateForCityAndService(
  city: string,
  serviceType: ServiceType,
): Promise<{ success: boolean; delegate?: DelegateInfo; error?: string }> {
  try {
    console.log("🔍 Recherche délégué pour:", { city, serviceType });

    // Rechercher d'abord avec service_type, puis avec service_admin si pas trouvé
    let delegate, error;

    // Première tentative avec service_type
    const result1 = await supabase
      .from("delegates")
      .select(
        `
        id,
        user_id,
        name,
        phone,
        email,
        city,
        service_type,
        service_admin,
        is_available,
        is_active,
        rating,
        total_completed
      `,
      )
      .eq("city", city)
      .eq("service_type", serviceType)
      .or("is_available.eq.true,is_active.eq.true")
      .maybeSingle();

    if (result1.data) {
      delegate = result1.data;
      error = result1.error;
    } else {
      // Deuxième tentative avec service_admin
      const result2 = await supabase
        .from("delegates")
        .select(
          `
          id,
          user_id,
          name,
          phone,
          email,
          city,
          service_type,
          service_admin,
          is_available,
          is_active,
          rating,
          total_completed
        `,
        )
        .eq("city", city)
        .eq("service_admin", serviceType)
        .or("is_available.eq.true,is_active.eq.true")
        .maybeSingle();

      delegate = result2.data;
      error = result2.error;
    }

    if (error) {
      console.error("❌ Erreur recherche délégué:", error);
      return { success: false, error: error.message };
    }

    if (!delegate) {
      return { success: false, error: "Aucun délégué disponible" };
    }

    console.log("✅ Délégué trouvé:", delegate.name);
    return { success: true, delegate };
  } catch (error: any) {
    console.error("💥 Erreur recherche délégué:", error);
    return { success: false, error: error.message || "Erreur inconnue" };
  }
}

/**
 * Assigner automatiquement un délégué à une demande
 */
export async function assignDelegateToRequest(
  requestId: string,
): Promise<{ success: boolean; delegateId?: string; error?: string }> {
  try {
    console.log("🎯 Assignation délégué pour demande:", requestId);

    // Récupérer les infos de la demande
    const { data: request, error: requestError } = await supabase
      .from("requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (requestError || !request) {
      return { success: false, error: "Demande introuvable" };
    }

    // Vérifier si un délégué n'est pas déjà assigné
    if (request.delegate_id) {
      console.log("⚠️ Délégué déjà assigné:", request.delegate_id);
      return { success: true, delegateId: request.delegate_id };
    }

    // Trouver LE délégué spécifique pour cette ville + service
    const delegateResult = await findDelegateForCityAndService(
      request.city,
      request.service_type,
    );

    if (!delegateResult.success || !delegateResult.delegate) {
      console.warn(
        "⚠️ Aucun délégué disponible pour:",
        request.city,
        request.service_type,
      );
      return {
        success: false,
        error: delegateResult.error || "Aucun délégué disponible",
      };
    }

    // Utiliser LE délégué trouvé
    const selectedDelegate = delegateResult.delegate;
    console.log(
      "✅ Délégué sélectionné:",
      selectedDelegate.name,
      `(${request.city} - ${request.service_type})`,
    );

    // Assigner le délégué à la demande
    // Vérifier que la demande existe avant l'assignation
    const { data: existingRequest } = await supabase
      .from("requests")
      .select("id, status, delegate_id")
      .eq("id", requestId)
      .single();

    console.log("🔍 Demande existante avant assignation:", existingRequest);

    console.log("📝 Tentative assignation:", {
      requestId,
      delegate_id: selectedDelegate.id,
      delegate_id_type: typeof selectedDelegate.id,
      status: "assigned",
    });

    const { data: updateResult, error: assignError } = await supabase
      .from("requests")
      .update({
        delegate_id: selectedDelegate.id,
        status: "assigned",
      })
      .eq("id", requestId)
      .select();

    console.log("📊 Résultat mise à jour:", updateResult);
    console.log("❓ Erreur mise à jour:", assignError);

    if (assignError) {
      console.error("❌ Erreur assignation:", assignError);
      return { success: false, error: assignError.message };
    }

    if (!updateResult || updateResult.length === 0) {
      console.error("❌ Aucune ligne mise à jour - demande introuvable");
      return { success: false, error: "Demande introuvable pour mise à jour" };
    }

    console.log("🎉 Délégué assigné avec succès!");

    // Envoyer notifications
    try {
      await NotificationService.processOrderWorkflow(requestId, "assigned", {
        delegateId: selectedDelegate.id,
      });
    } catch (notifError) {
      console.error(
        "⚠️ Erreur notification (assignation réussie quand même):",
        notifError,
      );
    }

    return { success: true, delegateId: selectedDelegate.id };
  } catch (error: any) {
    console.error("💥 Erreur assignation délégué:", error);
    return { success: false, error: error.message || "Erreur inconnue" };
  }
}

/**
 * Assigner automatiquement des délégués à plusieurs demandes (panier)
 */
export async function assignDelegatesToCart(
  requestIds: string[],
): Promise<{
  success: boolean;
  assignments?: Record<string, string>;
  errors?: Record<string, string>;
}> {
  try {
    console.log(
      "🛒 Assignation délégués pour panier:",
      requestIds.length,
      "demandes",
    );

    const assignments: Record<string, string> = {};
    const errors: Record<string, string> = {};

    // Assigner chaque demande individuellement
    for (const requestId of requestIds) {
      const result = await assignDelegateToRequest(requestId);

      if (result.success && result.delegateId) {
        assignments[requestId] = result.delegateId;
        console.log("✅ Assigné:", requestId, "→", result.delegateId);
      } else {
        errors[requestId] = result.error || "Erreur inconnue";
        console.error("❌ Échec assignation:", requestId, result.error);
      }
    }

    const totalAssigned = Object.keys(assignments).length;
    const totalErrors = Object.keys(errors).length;

    console.log(
      `📊 Assignation terminée: ${totalAssigned} réussies, ${totalErrors} échecs`,
    );

    return {
      success: totalAssigned > 0,
      assignments,
      errors: totalErrors > 0 ? errors : undefined,
    };
  } catch (error: any) {
    console.error("💥 Erreur assignation panier:", error);
    return {
      success: false,
      errors: { global: error.message || "Erreur inconnue" },
    };
  }
}

/**
 * Obtenir les villes qui ont des délégués disponibles
 */
export async function getAvailableCities(): Promise<{
  success: boolean;
  cities?: Array<{
    city: string;
    services: ServiceType[];
    totalDelegates: number;
  }>;
  error?: string;
}> {
  try {
    console.log("🏙️ Récupération des villes disponibles...");

    const { data, error } = await supabase
      .from("delegates")
      .select("city, service_type, service_admin, is_available, is_active");

    if (error) {
      console.error("❌ Erreur récupération délégués:", error);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: true, cities: [] };
    }

    // Grouper par ville et collecter les services
    const citiesMap = data.reduce((acc: any, delegate) => {
      // Utiliser service_type en priorité, sinon service_admin
      const serviceType = delegate.service_type || delegate.service_admin;

      // Filtrer seulement les délégués actifs/disponibles
      const isActive = delegate.is_available || delegate.is_active;
      if (!isActive) return acc;

      if (!acc[delegate.city]) {
        acc[delegate.city] = {
          city: delegate.city,
          services: [],
          totalDelegates: 0,
        };
      }
      if (!acc[delegate.city].services.includes(serviceType)) {
        acc[delegate.city].services.push(serviceType);
      }
      acc[delegate.city].totalDelegates++;
      return acc;
    }, {});

    const cities = Object.values(citiesMap);
    console.log("✅ Villes avec délégués:", cities.length);
    console.log("📊 Détail villes:", cities);
    return { success: true, cities };
  } catch (error: any) {
    console.error("💥 Erreur récupération villes:", error);
    return { success: false, error: error.message || "Erreur inconnue" };
  }
}

/**
 * Vérifier si une combinaison ville/service a un délégué disponible
 */
export async function isServiceAvailableInCity(
  city: string,
  serviceType: ServiceType,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("delegates")
      .select("id")
      .eq("city", city)
      .eq("service_type", serviceType)
      .eq("is_available", true)
      .single();

    return !error && data !== null;
  } catch {
    return false;
  }
}

/**
 * Obtenir les statistiques des délégués pour une ville
 */
export async function getDelegateStats(
  city: string,
): Promise<{ success: boolean; stats?: any; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("delegates")
      .select(
        `
        id,
        name,
        service_type,
        is_available,
        rating,
        total_completed
      `,
      )
      .eq("city", city);

    if (error) {
      return { success: false, error: error.message };
    }

    const stats = {
      total: data?.length || 0,
      available: data?.filter((d) => d.is_available).length || 0,
      averageRating: data?.length
        ? data.reduce((sum, d) => sum + d.rating, 0) / data.length
        : 0,
      totalCompleted: data?.reduce((sum, d) => sum + d.total_completed, 0) || 0,
      serviceTypes: [...new Set(data?.map((d) => d.service_type) || [])],
      delegatesByService: data?.reduce((acc: any, d) => {
        acc[d.service_type] = {
          name: d.name,
          available: d.is_available,
          rating: d.rating,
          total_completed: d.total_completed,
        };
        return acc;
      }, {}),
    };

    return { success: true, stats };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur inconnue" };
  }
}
