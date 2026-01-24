import type { DocumentType, ServiceType, DocumentConfig } from "../types";

// Configuration du délai de base (en heures)
export const BASE_PROCESSING_DELAY_HOURS = 72; // 3 jours (72h)

// Configuration des documents disponibles selon votre liste
export const DOCUMENT_CONFIGS: Record<DocumentType, DocumentConfig> = {
  declaration_naissance: {
    type: "declaration_naissance",
    name: "Déclaration de naissance",
    service: "mairie/sous-préfecture",
    base_price: 1000, // Prix de base, varie selon la ville
    processing_time: "72h", // Délai flexible
    required_fields: [
      "nom_enfant",
      "prenoms_enfant",
      "date_naissance",
      "lieu_naissance",
      "nom_pere",
      "nom_mere",
    ],
    required_documents: [
      "Certificat de naissance ou carnet de suivi de grossesse",
      "CNI ou extrait d'acte de naissance des parents",
    ],
  },
  extrait_acte_naissance: {
    type: "extrait_acte_naissance",
    name: "Extrait d'acte de naissance",
    service: "mairie/sous-préfecture",
    base_price: 1500,
    processing_time: "72h",
    required_fields: ["nom", "prenoms", "date_naissance", "lieu_naissance"],
    required_documents: [
      "Photocopie de l'extrait d'acte de naissance existant",
      "OU centre, numéro et date du registre",
    ],
  },
  copie_integrale_naissance: {
    type: "copie_integrale_naissance",
    name: "Copie intégrale d'extrait d'acte de naissance",
    service: "mairie/sous-préfecture",
    base_price: 2000,
    processing_time: "72h",
    required_fields: ["nom", "prenoms", "date_naissance", "lieu_naissance"],
    required_documents: [
      "Photocopie de l'extrait d'acte de naissance",
      "OU centre, numéro et date du registre",
    ],
  },
  extrait_acte_mariage: {
    type: "extrait_acte_mariage",
    name: "Extrait d'acte de mariage",
    service: "mairie/sous-préfecture",
    base_price: 2000,
    processing_time: "72h",
    required_fields: ["nom_complet", "numero_acte_mariage"],
    required_documents: [
      "Photocopie de l'extrait d'acte de mariage",
      "OU centre, numéro et date du registre",
    ],
  },
  copie_integrale_mariage: {
    type: "copie_integrale_mariage",
    name: "Copie intégrale d'extrait d'acte de mariage",
    service: "mairie/sous-préfecture",
    base_price: 2500,
    processing_time: "72h",
    required_fields: ["nom_complet", "numero_acte_mariage"],
    required_documents: [
      "Photocopie de l'extrait d'acte de mariage",
      "OU centre, numéro et date du registre",
    ],
  },
  certificat_celibat: {
    type: "certificat_celibat",
    name: "Certificat de célibat",
    service: "mairie/sous-préfecture",
    base_price: 1500,
    processing_time: "72h",
    required_fields: ["nom", "prenoms", "date_naissance", "lieu_naissance"],
    required_documents: [
      "Photocopie de l'extrait d'acte de naissance",
      "OU centre, numéro et date du registre",
    ],
  },
  certificat_non_divorce: {
    type: "certificat_non_divorce",
    name: "Certificat de non divorce non remariage",
    service: "mairie/sous-préfecture",
    base_price: 1500,
    processing_time: "72h",
    required_fields: ["nom", "prenoms", "date_naissance", "lieu_naissance"],
    required_documents: [
      "Photocopie de l'extrait d'acte de naissance",
      "OU centre, numéro et date du registre",
    ],
  },
  certificat_residence: {
    type: "certificat_residence",
    name: "Certificat de résidence",
    service: "mairie/sous-préfecture",
    base_price: 1000,
    processing_time: "72h",
    required_fields: ["nom_complet", "profession"],
    required_documents: ["CNI OU photocopie de l'extrait d'acte de naissance"],
  },
};

// Villes disponibles (à configurer via l'admin)
// Commençons avec une liste vide comme demandé
export const CITIES: string[] = [];

// Interface pour la gestion des villes avec leurs prix
export interface CityPricing {
  city: string;
  document_prices: Record<DocumentType, number>;
  shipping_cost: number;
  processing_delay_multiplier: number;
  is_active: boolean;
}

// Base de données des prix par ville (sera gérée depuis l'admin)
export let CITY_PRICING: CityPricing[] = [];

// Services administratifs
export const SERVICES: Record<ServiceType, string> = {
  mairie: "Mairie",
  sous_prefecture: "Sous-préfecture",
  justice: "Tribunal",
  "mairie/sous-préfecture": "Mairie/Sous-préfecture",
};

// Calculer le prix d'une demande (nouveau système)
export function calculatePrice(
  documentType: DocumentType,
  city: string,
  copies: number = 1,
  serviceType?: string,
): number {
  // Chercher les prix spécifiques à la ville
  const cityPricing = CITY_PRICING.find(
    (cp) => cp.city === city && cp.is_active,
  );

  if (cityPricing) {
    let documentPrice = 0;

    // Si un service spécifique est demandé, l'utiliser en priorité
    if (
      serviceType &&
      cityPricing.document_prices[serviceType] &&
      cityPricing.document_prices[serviceType][documentType]
    ) {
      documentPrice = cityPricing.document_prices[serviceType][documentType];
    } else {
      // Sinon, parcourir les services pour trouver le prix du document (fallback)
      const services = ["mairie", "sous_prefecture", "justice"];
      for (const service of services) {
        if (
          cityPricing.document_prices[service] &&
          cityPricing.document_prices[service][documentType]
        ) {
          documentPrice = cityPricing.document_prices[service][documentType];
          break;
        }
      }
    }

    if (documentPrice > 0) {
      const totalPrice = documentPrice * copies;
      return Math.round(totalPrice);
    }
  }

  // Prix de base si ville pas configurée ou prix non trouvé
  const config = DOCUMENT_CONFIGS[documentType];
  const basePrice = config.base_price * copies;

  return Math.round(basePrice);
}

// Obtenir les prix d'un document pour toutes les villes
export function getDocumentPricesAllCities(
  documentType: DocumentType,
): Array<{ city: string; price: number }> {
  return CITY_PRICING.filter((cp) => cp.is_active)
    .map((cp) => ({
      city: cp.city,
      price:
        cp.document_prices[documentType] ||
        DOCUMENT_CONFIGS[documentType].base_price,
    }))
    .sort((a, b) => a.price - b.price);
}

// Obtenir les villes actives
export function getActiveCities(): string[] {
  return CITY_PRICING.filter((cp) => cp.is_active)
    .map((cp) => cp.city)
    .sort();
}

// Ajouter une nouvelle ville (fonction pour l'admin)
export function addCity(cityPricing: CityPricing): void {
  CITY_PRICING = [
    ...CITY_PRICING.filter((cp) => cp.city !== cityPricing.city),
    cityPricing,
  ];
}

// Mettre à jour les prix d'une ville
export function updateCityPricing(
  city: string,
  updates: Partial<CityPricing>,
): void {
  CITY_PRICING = CITY_PRICING.map((cp) =>
    cp.city === city ? { ...cp, ...updates } : cp,
  );
}

// Synchroniser CITY_PRICING avec les données de la base de données
export function syncCityPricingFromDB(
  cities: Array<{
    name: string;
    document_prices: Record<string, Record<string, number>>;
    shipping_cost: number;
    processing_delay_multiplier: number;
    is_active: boolean;
  }>,
): void {
  CITY_PRICING = cities.map((city) => ({
    city: city.name,
    document_prices: city.document_prices as Record<DocumentType, number>,
    shipping_cost: city.shipping_cost,
    processing_delay_multiplier: city.processing_delay_multiplier,
    is_active: city.is_active,
  }));

  console.log("🔄 CITY_PRICING synchronisé:", CITY_PRICING);
}

// Calculer la dotation du délégué
export function calculateDelegateEarnings(totalAmount: number): number {
  // Le délégué reçoit 60% du montant total (hors frais de livraison)
  const commissionRate = 0.6;
  return Math.round(totalAmount * commissionRate);
}

// Estimer le temps de traitement
export function estimateCompletionTime(
  documentType: DocumentType,
  city: string,
): Date {
  // Délai par défaut : utilise la constante configurée
  let processingHours = BASE_PROCESSING_DELAY_HOURS;

  // Ajuster selon la ville (villes plus éloignées = plus de temps)
  const cityDelayMultiplier = getCityDelayMultiplier(city);
  processingHours *= cityDelayMultiplier;

  const completionDate = new Date();
  completionDate.setHours(completionDate.getHours() + processingHours);

  return completionDate;
}

function getCityDelayMultiplier(city: string): number {
  const delayMultipliers: Record<string, number> = {
    Abidjan: 1.0,
    Bouaké: 1.2,
    "San-Pédro": 1.3,
    Yamoussoukro: 1.1,
    Daloa: 1.4,
    Korhogo: 1.5,
    Man: 1.6,
    Divo: 1.3,
    Gagnoa: 1.3,
    Abengourou: 1.4,
  };

  return delayMultipliers[city] || 1.3;
}
