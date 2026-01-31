import type { BillingDetails, DocumentType } from "../types";
import { DOCUMENT_CONFIGS, calculatePrice } from "./documents";

/**
 * Fonction pour déterminer si une ville fait partie d'Abidjan
 */
function isAbidjanCommune(ville: string | undefined): boolean {
  if (!ville || typeof ville !== "string") return false;
  const communesAbidjan = [
    "abidjan", "cocody", "plateau", "adjame", "abobo", "yopougon",
    "koumassi", "port-bouet", "marcory", "treichville", "attécoubé",
    "anyama", "bingerville", "songon", "grand-bassam", "dabou",
    "jacqueville", "grand-lahou",
  ];
  return communesAbidjan.includes(ville.toLowerCase().trim());
}

/**
 * Capture les détails de facturation pour un document unique (mobile)
 * Ces détails resteront figés même si les tarifs changent par la suite
 */
export function captureSingleDocumentBillingDetails(
  documentType: DocumentType,
  copies: number,
  city: string,
  serviceType: string,
  deliveryData: Record<string, string>,
  expressPriceOverride?: number
): BillingDetails {
  const docConfig = DOCUMENT_CONFIGS[documentType];
  const unitPrice = calculatePrice(documentType, city, 1, serviceType);
  const totalPrice = unitPrice * copies;

  // Calcul des frais de prestation
  const moyenRecuperation = deliveryData["moyen_recuperation"];
  const isRecuperationDirecte = moyenRecuperation?.startsWith("moi_meme_service_");

  let prestationFee = 0;
  let prestationDescription = "";

  if (isRecuperationDirecte) {
    prestationFee = 1000;
    prestationDescription = "Prestation (récupération directe)";
  } else {
    // Document unique : toujours 2000 FCFA (pas de tarification progressive en mobile)
    prestationFee = 2000;
    prestationDescription = "Prestation";
  }

  // Calcul des frais d'expédition (logique complète)
  const villeEtablissement = city?.toLowerCase() || "";
  const villeDestination = deliveryData["ville_destination"] || "";
  const isEtablissementAbidjan = villeEtablissement === "abidjan" || isAbidjanCommune(villeEtablissement);
  const isDestinationAbidjan = isAbidjanCommune(villeDestination);
  const moyenExpedition = deliveryData["moyen_expedition"];
  const totalCopies = copies;

  let fraisExpedition = 0;
  let expeditionDescription = "";

  // Application de la logique de livraison
  if (isEtablissementAbidjan && isDestinationAbidjan) {
    // Pas de frais d'expédition pour Abidjan à Abidjan
  } else if (villeEtablissement === villeDestination.toLowerCase()) {
    // Pas de frais d'expédition si même ville
  } else if (isEtablissementAbidjan && !isDestinationAbidjan) {
    if (moyenRecuperation === "moi_meme_gare" || moyenRecuperation === "livraison_express") {
      fraisExpedition = moyenExpedition === "utb" ? 1000 * totalCopies : 1000;
      const moyenText = moyenExpedition === 'utb' ? 'UTB' : (deliveryData["preference_transport"] || 'autre compagnie');
      const villeEtabFormatted = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
      let villeDestFormatted = villeDestination.charAt(0).toUpperCase() + villeDestination.slice(1).toLowerCase();

      if (isAbidjanCommune(villeDestFormatted)) {
        villeDestFormatted = 'Abidjan';
      }

      expeditionDescription = `Expédition de ${villeEtabFormatted} à ${villeDestFormatted} par ${moyenText}`;
    }
  } else if (!isEtablissementAbidjan && isDestinationAbidjan) {
    if (moyenRecuperation === "moi_meme_gare") {
      fraisExpedition = moyenExpedition === "utb" ? 1000 * totalCopies : 1000;
      const moyenText = moyenExpedition === 'utb' ? 'UTB' : (deliveryData["preference_transport"] || 'autre compagnie');
      const villeEtabFormatted = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
      let villeDestFormatted = villeDestination.charAt(0).toUpperCase() + villeDestination.slice(1).toLowerCase();

      if (isAbidjanCommune(villeDestFormatted)) {
        villeDestFormatted = 'Abidjan';
      }

      expeditionDescription = `Expédition de ${villeEtabFormatted} à ${villeDestFormatted} par ${moyenText}`;
    } else if (moyenRecuperation === "livraison_express") {
      fraisExpedition = moyenExpedition === "utb" ? 1000 * totalCopies : 1000;
      const moyenText = moyenExpedition === 'utb' ? 'UTB' : (deliveryData["preference_transport"] || 'autre compagnie');
      const villeEtabFormatted = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
      let villeDestFormatted = villeDestination.charAt(0).toUpperCase() + villeDestination.slice(1).toLowerCase();

      if (isAbidjanCommune(villeDestFormatted)) {
        villeDestFormatted = 'Abidjan';
      }

      expeditionDescription = `Expédition de ${villeEtabFormatted} à ${villeDestFormatted} par ${moyenText}`;
    }
  } else if (!isEtablissementAbidjan && !isDestinationAbidjan) {
    if (moyenRecuperation === "moi_meme_gare") {
      if (moyenExpedition === "expedition_abidjan") {
        fraisExpedition = 4000;
        const villeEtabFormatted = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
        let villeDestFormatted = villeDestination.charAt(0).toUpperCase() + villeDestination.slice(1).toLowerCase();

        if (isAbidjanCommune(villeDestFormatted)) {
          villeDestFormatted = 'Abidjan';
        }

        expeditionDescription = `Expédition de ${villeEtabFormatted} à ${villeDestFormatted} par expédition par Abidjan`;
      } else {
        fraisExpedition = moyenExpedition === "utb" ? 1000 * totalCopies : 1000;
        const moyenText = moyenExpedition === 'utb' ? 'UTB' : (deliveryData["preference_transport"] || 'autre compagnie');
        const villeEtabFormatted = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
        let villeDestFormatted = villeDestination.charAt(0).toUpperCase() + villeDestination.slice(1).toLowerCase();

        if (isAbidjanCommune(villeDestFormatted)) {
          villeDestFormatted = 'Abidjan';
        }

        expeditionDescription = `Expédition de ${villeEtabFormatted} à ${villeDestFormatted} par ${moyenText}`;
      }
    } else if (moyenRecuperation === "livraison_express") {
      if (moyenExpedition === "expedition_abidjan") {
        fraisExpedition = 4000;
        const villeEtabFormatted = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
        let villeDestFormatted = villeDestination.charAt(0).toUpperCase() + villeDestination.slice(1).toLowerCase();

        if (isAbidjanCommune(villeDestFormatted)) {
          villeDestFormatted = 'Abidjan';
        }

        expeditionDescription = `Expédition de ${villeEtabFormatted} à ${villeDestFormatted} par expédition par Abidjan`;
      } else {
        fraisExpedition = moyenExpedition === "utb" ? 1000 * totalCopies : 1000;
        const moyenText = moyenExpedition === 'utb' ? 'UTB' : (deliveryData["preference_transport"] || 'autre compagnie');
        const villeEtabFormatted = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
        let villeDestFormatted = villeDestination.charAt(0).toUpperCase() + villeDestination.slice(1).toLowerCase();

        if (isAbidjanCommune(villeDestFormatted)) {
          villeDestFormatted = 'Abidjan';
        }

        expeditionDescription = `Expédition de ${villeEtabFormatted} à ${villeDestFormatted} par ${moyenText}`;
      }
    }
  }

  // Livraison express
  let livraisonExpress = 0;

  if (isEtablissementAbidjan && isDestinationAbidjan) {
    if (moyenRecuperation === "livraison_express") {
      livraisonExpress = expressPriceOverride ?? 2000;
    }
  } else if (isEtablissementAbidjan && !isDestinationAbidjan) {
    // Pickup obligatoire par livreur (mairie → gare d'Adjame), quel que soit le moyen de recuperation
    if (moyenRecuperation === "moi_meme_gare" || moyenRecuperation === "livraison_express") {
      livraisonExpress = expressPriceOverride ?? 2000;
    }
  } else if (!isEtablissementAbidjan && isDestinationAbidjan) {
    if (moyenRecuperation === "livraison_express") {
      livraisonExpress = expressPriceOverride ?? 2000;
    }
  } else if (!isEtablissementAbidjan && !isDestinationAbidjan) {
    if (moyenRecuperation === "livraison_express") {
      livraisonExpress = expressPriceOverride ?? 2000;
    }
  }

  // Construire les détails de facturation
  const billingDetails: BillingDetails = {
    documents: [{
      document_type: documentType,
      document_name: docConfig.name,
      copies: copies,
      unit_price: unitPrice,
      total_price: totalPrice,
    }],
    prestation: {
      description: prestationDescription,
      amount: prestationFee,
    },
    total_amount: totalPrice + prestationFee + fraisExpedition + livraisonExpress,
    payment_breakdown: {
      documents_subtotal: totalPrice,
      prestation_fee: prestationFee,
      shipping_fee: fraisExpedition,
      express_fee: livraisonExpress,
    }
  };

  if (fraisExpedition > 0) {
    billingDetails.shipping = {
      description: expeditionDescription,
      amount: fraisExpedition,
    };
  }

  if (livraisonExpress > 0) {
    const expressDescription = isEtablissementAbidjan && !isDestinationAbidjan
      ? `Recuperation livreur (mairie → gare)`
      : "Livraison express";
    billingDetails.express_delivery = {
      description: expressDescription,
      amount: livraisonExpress,
    };
  }

  return billingDetails;
}
