import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button as PaperButton, Divider, RadioButton } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import PhotoUploader from '../../components/request/PhotoUploader';
import { DOCUMENT_CONFIGS, calculatePrice } from '../../utils/documents';
import { captureSingleDocumentBillingDetails } from '../../utils/billingCapture';
import { getAvailableCities } from '../../services/delegateAssignmentService';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { logCitySearch } from '../../services/citySearchService';
import { getExpressCommunesWithSectors, calculateExpressPrice, calculatePickupToGarePrice, generateDeliveryCode } from '../../services/deliveryService';
import type { DocumentType, DeliverySector } from '../../types';

/**
 * Utilitaire pour vérifier si une ville est une commune d'Abidjan
 */
function isAbidjanCommune(ville: string): boolean {
  if (!ville || typeof ville !== 'string') return false;
  const communesAbidjan = [
    "abidjan", "cocody", "plateau", "adjame", "abobo", "yopougon",
    "koumassi", "port-bouet", "marcory", "treichville", "attécoubé",
    "anyama", "bingerville", "songon"
  ];
  return communesAbidjan.includes(ville.toLowerCase().trim());
}

export default function RequestFormScreen({ route, navigation }: any) {
  const { documentType, prefillData } = route.params as {
    documentType: DocumentType;
    prefillData?: {
      city?: string;
      service_type?: string;
      copies?: number;
      form_data?: Record<string, any>;
    };
  };
  const documentConfig = DOCUMENT_CONFIGS[documentType];
  const { user, profile } = useAuthStore();

  // Étape courante (1 ou 2)
  const [currentStep, setCurrentStep] = useState(1);
  const scrollViewRef = useRef<ScrollView>(null);

  // État du formulaire - Étape 1
  const [city, setCity] = useState('');
  const [serviceAdmin, setServiceAdmin] = useState('');
  const [copies, setCopies] = useState(2);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [images, setImages] = useState<{ uri: string; name: string; type: string }[]>([]);

  // État du formulaire - Étape 2 (Livraison)
  const [deliveryData, setDeliveryData] = useState<Record<string, string>>({});
  const [deliveryMode, setDeliveryMode] = useState<'pickup' | 'delivery' | ''>('');

  // État pour la ville (autocomplete)
  const [availableCities, setAvailableCities] = useState<Array<{
    city: string;
    services: string[];
    totalDelegates: number;
  }>>([]);
  const [citySearchTerm, setCitySearchTerm] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [showCopiesDropdown, setShowCopiesDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cityNotAvailable, setCityNotAvailable] = useState(false);

  // État pour la livraison express par secteur
  const [expressCommunesData, setExpressCommunesData] = useState<Array<{ commune: string; sectors: DeliverySector[] }>>([]);
  const [selectedExpressCommune, setSelectedExpressCommune] = useState('');
  const [selectedExpressSector, setSelectedExpressSector] = useState<DeliverySector | null>(null);
  const [expressPrice, setExpressPrice] = useState<number | null>(null);
  const [expressDistanceKm, setExpressDistanceKm] = useState<number | null>(null);
  const [showExpressCommuneDropdown, setShowExpressCommuneDropdown] = useState(false);
  const [showExpressSectorDropdown, setShowExpressSectorDropdown] = useState(false);
  // Prix automatique mairie → gare d'Adjame (obligatoire pour Abidjan → Interieur)
  const [pickupToGarePrice, setPickupToGarePrice] = useState<number | null>(null);
  const [pickupToGareDistanceKm, setPickupToGareDistanceKm] = useState<number | null>(null);

  // Chargement des villes disponibles
  useEffect(() => {
    loadAvailableCities();
    loadExpressCommunes();
  }, []);

  // Charger les communes express disponibles
  const loadExpressCommunes = async () => {
    try {
      const data = await getExpressCommunesWithSectors();
      setExpressCommunesData(data);
    } catch (error) {
      console.error('Erreur chargement communes express:', error);
    }
  };

  // Calculer le prix express quand un secteur est selectionne
  useEffect(() => {
    if (selectedExpressSector && city) {
      const computePrice = async () => {
        const result = await calculateExpressPrice(city, selectedExpressSector);
        if (result) {
          setExpressPrice(result.price);
          setExpressDistanceKm(result.distanceKm);
        }
      };
      computePrice();
    } else {
      setExpressPrice(null);
      setExpressDistanceKm(null);
    }
  }, [selectedExpressSector, city]);

  // Calculer automatiquement le prix pickup mairie → gare d'Adjame (Abidjan → Interieur)
  useEffect(() => {
    const villeDestination = deliveryData.ville_destination;
    if (city && isAbidjanCommune(city) && villeDestination && !isAbidjanCommune(villeDestination)) {
      const compute = async () => {
        const result = await calculatePickupToGarePrice(city);
        if (result) {
          setPickupToGarePrice(result.price);
          setPickupToGareDistanceKm(result.distanceKm);
        }
      };
      compute();
    } else {
      setPickupToGarePrice(null);
      setPickupToGareDistanceKm(null);
    }
  }, [city, deliveryData.ville_destination]);

  // Pré-remplir les données si modification d'une demande existante
  useEffect(() => {
    if (prefillData) {
      if (prefillData.city) setCity(prefillData.city);
      if (prefillData.service_type) setServiceAdmin(prefillData.service_type);
      if (prefillData.copies) setCopies(prefillData.copies);
      if (prefillData.form_data) {
        // Séparer les données du formulaire et les données de livraison
        const { nom_destinataire, contact1, contact2, mode_livraison, ...rest } = prefillData.form_data;
        setFormData(rest);
        setDeliveryData({
          nom_destinataire: nom_destinataire || '',
          contact1: contact1 || '',
          contact2: contact2 || '',
          mode_livraison: mode_livraison || 'retrait',
        });
      }
      toast.success('Formulaire pré-rempli avec vos données');
    }
  }, [prefillData]);

  const loadAvailableCities = async () => {
    try {
      const result = await getAvailableCities();
      if (result.success && result.cities) {
        setAvailableCities(result.cities);
        // Sélectionner automatiquement la première ville
        if (result.cities.length > 0 && !city) {
          setCity(result.cities[0].city);
        }
      } else {
        // Villes par défaut
        const defaultCities = [
          { city: 'Abidjan', services: ['mairie', 'sous_prefecture'], totalDelegates: 5 },
          { city: 'Bouaké', services: ['mairie', 'sous_prefecture'], totalDelegates: 3 },
          { city: 'Yamoussoukro', services: ['mairie', 'sous_prefecture'], totalDelegates: 4 },
          { city: 'Daloa', services: ['mairie'], totalDelegates: 2 },
        ];
        setAvailableCities(defaultCities);
        setCity(defaultCities[0].city);
      }
    } catch (error) {
      console.error('Erreur chargement villes:', error);
    }
  };

  // Services disponibles pour la ville sélectionnée
  const availableServices = useMemo(() => {
    if (!city) return [];
    const cityData = availableCities.find(c => c.city === city);
    return cityData ? cityData.services : [];
  }, [city, availableCities]);

  // Mise à jour automatique du service quand on change de ville
  useEffect(() => {
    if (availableServices.length > 0 && !availableServices.includes(serviceAdmin)) {
      setServiceAdmin(availableServices[0]);
    }
  }, [availableServices]);

  // Pré-remplir les champs de livraison avec les infos du profil
  useEffect(() => {
    if (currentStep === 2 && profile && !deliveryData.nom_destinataire) {
      setDeliveryData(prev => ({
        ...prev,
        nom_destinataire: profile.name || '',
        contact1: profile.phone || '',
      }));
    }
  }, [currentStep, profile]);

  // Reset au changement de deliveryMode
  useEffect(() => {
    if (deliveryMode === 'pickup') {
      setDeliveryData(prev => ({
        ...prev,
        moyen_recuperation: `moi_meme_service_${city}`,
        ville_destination: '',
        moyen_expedition: '',
        preference_transport: '',
      }));
      setSelectedExpressCommune('');
      setSelectedExpressSector(null);
    } else if (deliveryMode === 'delivery') {
      setDeliveryData(prev => ({
        ...prev,
        moyen_recuperation: '',
        moyen_expedition: '',
        preference_transport: '',
      }));
      setSelectedExpressCommune('');
      setSelectedExpressSector(null);
    }
  }, [deliveryMode]);

  // Auto-set moyen_recuperation selon le scenario (en mode delivery)
  useEffect(() => {
    if (deliveryMode !== 'delivery') return;
    if (!deliveryScenario) return;
    if (deliveryScenario === 'case_a') {
      setDeliveryData(prev => ({ ...prev, moyen_recuperation: 'livraison_express', moyen_expedition: '' }));
    } else if (deliveryScenario === 'case_c') {
      setDeliveryData(prev => ({ ...prev, moyen_recuperation: 'moi_meme_gare' }));
    } else if (deliveryScenario === 'case_b') {
      setDeliveryData(prev => ({ ...prev, moyen_recuperation: '', moyen_expedition: '' }));
      setSelectedExpressCommune('');
      setSelectedExpressSector(null);
    }
  }, [deliveryScenario, deliveryMode]);

  // Prefill deliveryMode depuis données pré-remplies
  useEffect(() => {
    if (deliveryData.moyen_recuperation && !deliveryMode) {
      if (deliveryData.moyen_recuperation.startsWith('moi_meme_service_')) {
        setDeliveryMode('pickup');
      } else {
        setDeliveryMode('delivery');
      }
    }
  }, [deliveryData.moyen_recuperation]);

  // Prix du document uniquement
  const documentsOnlyPrice = useMemo(() => {
    if (!city || !serviceAdmin) return 0;
    try {
      return calculatePrice(documentType, city, copies, serviceAdmin);
    } catch (error) {
      console.error('Erreur calcul prix:', error);
      return documentConfig.base_price * copies;
    }
  }, [documentType, city, copies, serviceAdmin]);

  // Billing details complet avec livraison
  const { estimatedPrice, billingDetails } = useMemo(() => {
    if (!city || !serviceAdmin) return { estimatedPrice: 0, billingDetails: null };

    try {
      // Prix express: soit secteur intra-Abidjan, soit pickup auto vers gare
      const effectiveExpressPrice = expressPrice ?? pickupToGarePrice ?? undefined;

      const billing = captureSingleDocumentBillingDetails(
        documentType,
        copies,
        city,
        serviceAdmin,
        deliveryData,
        effectiveExpressPrice
      );

      return {
        estimatedPrice: billing.total_amount,
        billingDetails: billing
      };
    } catch (error) {
      console.error('Erreur calcul prix:', error);
      return { estimatedPrice: 0, billingDetails: null };
    }
  }, [documentType, copies, city, serviceAdmin, deliveryData, expressPrice, pickupToGarePrice]);

  // Scenario de livraison basé sur source/destination
  const deliveryScenario = useMemo(() => {
    const dest = deliveryData.ville_destination?.trim() || '';
    if (!dest) return null;
    const sourceIsAbidjan = isAbidjanCommune(city);
    const destIsAbidjan = isAbidjanCommune(dest);
    if (sourceIsAbidjan && destIsAbidjan) return 'case_a';
    if (!sourceIsAbidjan && destIsAbidjan) return 'case_b';
    return 'case_c';
  }, [city, deliveryData.ville_destination]);

  // Faut-il afficher la section expédition ?
  const needsExpeditionSection = useMemo(() => {
    if (deliveryMode !== 'delivery') return false;
    if (!deliveryScenario) return false;
    if (deliveryScenario === 'case_a') return false;
    if (deliveryScenario === 'case_b') return !!deliveryData.moyen_recuperation;
    return true; // case_c
  }, [deliveryMode, deliveryScenario, deliveryData.moyen_recuperation]);

  // Catégorie du document
  const documentCategory = useMemo(() => {
    if (['declaration_naissance', 'extrait_acte_naissance', 'copie_integrale_naissance'].includes(documentType)) {
      return 'naissance';
    }
    if (['certificat_celibat', 'certificat_non_divorce', 'certificat_residence'].includes(documentType)) {
      return 'certificat';
    }
    if (['extrait_acte_mariage', 'copie_integrale_mariage'].includes(documentType)) {
      return 'mariage';
    }
    return 'autre';
  }, [documentType]);

  // Validation des champs requis de l'étape 1
  const areRequiredFieldsFilled = () => {
    let requiredFields: string[] = [];

    if (documentType === 'declaration_naissance') {
      requiredFields = ['nom_enfant', 'sexe_enfant', 'date_naissance_enfant', 'lieu_naissance_enfant', 'nom_pere', 'nom_mere'];
    } else if (['extrait_acte_naissance', 'copie_integrale_naissance', 'certificat_celibat', 'certificat_non_divorce'].includes(documentType)) {
      requiredFields = ['nom_complet', 'numero_acte_naissance'];
    } else if (['extrait_acte_mariage', 'copie_integrale_mariage'].includes(documentType)) {
      requiredFields = ['nom_complet', 'numero_acte_mariage'];
    } else if (documentType === 'certificat_residence') {
      requiredFields = ['nom_complet', 'adresse_residence'];
    }

    const missingFields = requiredFields.filter(
      field => !formData[field] || formData[field].trim() === ''
    );

    return missingFields.length === 0;
  };

  // Validation de l'étape 2
  const isStep2Valid = useMemo(() => {
    // Toujours requis: nom, contact, mode
    if (!deliveryData.nom_destinataire?.trim()) return false;
    if (!deliveryData.contact1?.trim()) return false;
    if (!deliveryMode) return false;

    // Pickup: moyen_recuperation doit commencer par moi_meme_service_
    if (deliveryMode === 'pickup') {
      return !!deliveryData.moyen_recuperation?.startsWith('moi_meme_service_');
    }

    // Delivery: ville_destination requise
    if (!deliveryData.ville_destination?.trim()) return false;
    if (!deliveryScenario) return false;

    if (deliveryScenario === 'case_a') {
      // Express intra-Abidjan: secteur requis
      return !!selectedExpressSector;
    }

    if (deliveryScenario === 'case_b') {
      if (!deliveryData.moyen_recuperation) return false;
      if (deliveryData.moyen_recuperation === 'livraison_express') {
        // Express + expedition
        if (!selectedExpressSector) return false;
        if (!deliveryData.moyen_expedition) return false;
      } else {
        // Gare: expedition requise
        if (!deliveryData.moyen_expedition) return false;
      }
    }

    if (deliveryScenario === 'case_c') {
      if (!deliveryData.moyen_expedition) return false;
    }

    // Compagnie custom: nom requis
    if (deliveryData.moyen_expedition === 'transport_classique' && !deliveryData.preference_transport?.trim()) return false;

    return true;
  }, [deliveryData, deliveryMode, deliveryScenario, selectedExpressSector]);

  const handleNextStep = () => {
    if (!city || !serviceAdmin) {
      toast.error('Veuillez sélectionner une ville et un service');
      return;
    }
    if (!areRequiredFieldsFilled()) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setCurrentStep(2);
    // Scroll en haut de la page
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  };

  const handleSubmit = () => {
    if (!isStep2Valid) {
      toast.error('Veuillez remplir toutes les informations de livraison');
      return;
    }

    // Generer un code secret si un livreur intervient
    const isExpress = deliveryData.moyen_recuperation === 'livraison_express';
    const isPickupAutoToGare = deliveryData.moyen_recuperation === 'moi_meme_gare'
      && isAbidjanCommune(city)
      && deliveryData.ville_destination
      && !isAbidjanCommune(deliveryData.ville_destination);
    const needsDriver = isExpress || isPickupAutoToGare;
    const deliveryCode = needsDriver ? generateDeliveryCode() : undefined;

    // Préparer les données de la demande
    const requestData = {
      user_id: user!.id,
      document_type: documentType,
      service_type: serviceAdmin,
      city: city.trim(),
      copies: copies,
      total_amount: estimatedPrice,
      delegate_earnings: estimatedPrice * 0.6,
      delivery_sector_id: selectedExpressSector?.id || undefined,
      delivery_zone_id: selectedExpressSector?.zone_id || undefined,
      delivery_code: deliveryCode,
      form_data: {
        ...formData,
        ...deliveryData,
        delivery_commune: selectedExpressCommune || undefined,
        delivery_sector_name: selectedExpressSector?.name || undefined,
        billing_details: billingDetails // FIGÉ
      },
      images,
    };

    // Navigation vers le paiement
    navigation.navigate('Payment', { requestData });
  };

  return (
    <View style={styles.container}>
      {/* Header personnalisé */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {documentConfig.name}
          </Text>
          <Text style={styles.headerSubtitle}>Nouvelle demande</Text>
        </View>
      </View>

      {/* Indicateur de progression */}
      <View style={styles.progressCard}>
        <View style={styles.progressIndicator}>
          <View style={styles.stepContainer}>
            <View style={[styles.stepCircle, currentStep >= 1 && styles.stepCircleActive]}>
              <Text style={[styles.stepNumber, currentStep >= 1 && styles.stepNumberActive]}>1</Text>
            </View>
            <Text style={[styles.stepLabel, currentStep >= 1 && styles.stepLabelActive]}>Informations</Text>
          </View>
          <View style={[styles.stepDivider, currentStep >= 2 && styles.stepDividerActive]} />
          <View style={styles.stepContainer}>
            <View style={[styles.stepCircle, currentStep >= 2 && styles.stepCircleActive]}>
              <Text style={[styles.stepNumber, currentStep >= 2 && styles.stepNumberActive]}>2</Text>
            </View>
            <Text style={[styles.stepLabel, currentStep >= 2 && styles.stepLabelActive]}>Livraison</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent}>
          {/* ÉTAPE 1 : Informations du document */}
          {currentStep === 1 && (
            <>
              {/* Informations générales */}
              <SectionCard title="Informations du document" icon="document-text">
                {/* Ville avec recherche */}
                <Text style={styles.label}>Ville où sera établi le document *</Text>
                <View>
                  <TextInput
                    label=""
                    value={showCityDropdown ? citySearchTerm : city}
                    onChangeText={(value) => {
                      setCitySearchTerm(value);
                      setShowCityDropdown(true);
                      setCityNotAvailable(false);

                      // Si le champ est vidé, réinitialiser la ville
                      if (value.trim() === '') {
                        setCity('');
                        setServiceAdmin('');
                        return;
                      }

                      // Si correspondance exacte, sélectionner immédiatement
                      const exactMatch = availableCities.find(c =>
                        c.city.toLowerCase() === value.toLowerCase()
                      );

                      if (exactMatch) {
                        setCity(exactMatch.city);
                        setCityNotAvailable(false);
                        // Mettre à jour le service si nécessaire
                        if (!exactMatch.services.includes(serviceAdmin)) {
                          setServiceAdmin(exactMatch.services[0] || '');
                        }
                      }
                    }}
                    onBlur={() => {
                      // Vérifier si la ville saisie existe quand l'utilisateur quitte le champ
                      if (citySearchTerm.trim() && !city) {
                        const searchTerm = citySearchTerm.toLowerCase().trim();
                        const cityExists = availableCities.some(c =>
                          c.city.toLowerCase().includes(searchTerm) ||
                          c.city.toLowerCase() === searchTerm
                        );
                        if (!cityExists && citySearchTerm.length >= 2) {
                          setCityNotAvailable(true);
                          // Enregistrer la recherche pour l'admin
                          logCitySearch(citySearchTerm.trim(), user?.id);
                        }
                      }
                    }}
                    onFocus={() => {
                      setCitySearchTerm('');
                      setShowCityDropdown(true);
                      setShowServiceDropdown(false);
                      setShowCopiesDropdown(false);
                      setCityNotAvailable(false);
                    }}
                    mode="outlined"
                    style={[styles.input, cityNotAvailable && styles.inputError]}
                    placeholder="Tapez pour rechercher une ville..."
                    outlineColor={cityNotAvailable ? "#dc2626" : "#e5e7eb"}
                    activeOutlineColor={cityNotAvailable ? "#dc2626" : "#047857"}
                    right={<TextInput.Icon icon="map-marker" color={cityNotAvailable ? "#dc2626" : "#6b7280"} />}
                  />

                  {/* Message d'erreur ville non disponible */}
                  {cityNotAvailable && (
                    <View style={styles.cityNotAvailableMessage}>
                      <Ionicons name="information-circle" size={18} color="#dc2626" />
                      <Text style={styles.cityNotAvailableText}>
                        Nous n'intervenons pas encore dans cette localité. Veuillez sélectionner une ville parmi celles proposées.
                      </Text>
                    </View>
                  )}

                  {/* Dropdown des villes filtrées */}
                  {showCityDropdown && (
                    <View style={styles.cityDropdown}>
                      <ScrollView style={styles.cityDropdownScroll} nestedScrollEnabled={true}>
                        {(() => {
                          // Filtrage intelligent
                          const searchTerm = (citySearchTerm || '').toLowerCase().trim();
                          const filteredCities = availableCities.filter(cityData => {
                            const cityName = cityData.city.toLowerCase();

                            // 1. Correspondance directe
                            if (cityName.includes(searchTerm)) return true;

                            // 2. Correspondance par initiales
                            const initials = cityName.split(/[\s-]/).map(word => word[0]).join('');
                            if (initials.includes(searchTerm)) return true;

                            // 3. Normalisation (suppression accents)
                            const normalized = cityName
                              .normalize('NFD')
                              .replace(/[\u0300-\u036f]/g, '')
                              .replace(/[^a-z]/g, '');
                            const searchNormalized = searchTerm
                              .normalize('NFD')
                              .replace(/[\u0300-\u036f]/g, '')
                              .replace(/[^a-z]/g, '');
                            if (normalized.includes(searchNormalized)) return true;

                            return false;
                          }).sort((a, b) => {
                            // Tri par pertinence
                            const aName = a.city.toLowerCase();
                            const bName = b.city.toLowerCase();
                            const aStartsWith = aName.startsWith(searchTerm);
                            const bStartsWith = bName.startsWith(searchTerm);

                            if (aStartsWith && !bStartsWith) return -1;
                            if (!aStartsWith && bStartsWith) return 1;
                            return aName.localeCompare(bName);
                          });

                          if (filteredCities.length === 0) {
                            return (
                              <View style={styles.cityDropdownEmpty}>
                                <Ionicons name="location-outline" size={32} color="#9ca3af" style={{ marginBottom: 12 }} />
                                <Text style={styles.cityDropdownEmptyTitle}>Localité non desservie</Text>
                                <Text style={styles.cityDropdownEmptyText}>
                                  Nous n'intervenons pas encore dans cette localité.{'\n'}
                                  Notre réseau s'étend progressivement à de nouvelles villes.
                                </Text>
                              </View>
                            );
                          }

                          return filteredCities.map((cityData) => (
                            <TouchableOpacity
                              key={cityData.city}
                              style={styles.cityOption}
                              onPress={() => {
                                setCity(cityData.city);
                                setCitySearchTerm('');
                                setShowCityDropdown(false);

                                // Mettre à jour le service si nécessaire
                                if (!cityData.services.includes(serviceAdmin)) {
                                  setServiceAdmin(cityData.services[0] || '');
                                }
                              }}
                            >
                              <Text style={styles.cityOptionName}>{cityData.city}</Text>
                              <Text style={styles.cityOptionInfo}>
                                {cityData.totalDelegates} service{cityData.totalDelegates > 1 ? 's' : ''}
                              </Text>
                            </TouchableOpacity>
                          ));
                        })()}
                      </ScrollView>

                      {/* Bouton pour fermer le dropdown */}
                      <TouchableOpacity
                        style={styles.cityDropdownClose}
                        onPress={() => {
                          setShowCityDropdown(false);
                          setCitySearchTerm('');
                        }}
                      >
                        <Ionicons name="close" size={20} color="#047857" />
                        <Text style={styles.cityDropdownCloseText}>Fermer</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Service administratif */}
                <Text style={styles.label}>Service administratif *</Text>
                <View>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => {
                      if (availableServices.length > 0) {
                        setShowServiceDropdown(!showServiceDropdown);
                        setShowCityDropdown(false);
                        setShowCopiesDropdown(false);
                      }
                    }}
                  >
                    <Text style={serviceAdmin ? styles.pickerButtonTextSelected : styles.pickerButtonTextPlaceholder}>
                      {serviceAdmin
                        ? serviceAdmin === 'mairie'
                          ? 'Mairie'
                          : serviceAdmin === 'sous_prefecture'
                          ? 'Sous-préfecture'
                          : 'Justice'
                        : 'Choisissez le service'}
                    </Text>
                    <Ionicons
                      name={showServiceDropdown ? "chevron-up" : "chevron-down"}
                      size={20}
                      color="#047857"
                    />
                  </TouchableOpacity>

                  {/* Dropdown des services */}
                  {showServiceDropdown && (
                    <View style={styles.cityDropdown}>
                      <ScrollView style={styles.cityDropdownScroll} nestedScrollEnabled={true}>
                        {availableServices.length === 0 ? (
                          <View style={styles.cityDropdownEmpty}>
                            <Text style={styles.cityDropdownEmptyText}>
                              Sélectionnez d'abord une ville
                            </Text>
                          </View>
                        ) : (
                          availableServices.map((service) => (
                            <TouchableOpacity
                              key={service}
                              style={styles.serviceOption}
                              onPress={() => {
                                setServiceAdmin(service);
                                setShowServiceDropdown(false);
                              }}
                            >
                              <Ionicons
                                name={
                                  service === 'mairie'
                                    ? 'business'
                                    : service === 'sous_prefecture'
                                    ? 'flag'
                                    : 'shield-checkmark'
                                }
                                size={20}
                                color="#047857"
                              />
                              <Text style={styles.serviceOptionName}>
                                {service === 'mairie'
                                  ? 'Mairie'
                                  : service === 'sous_prefecture'
                                  ? 'Sous-préfecture'
                                  : 'Justice'}
                              </Text>
                            </TouchableOpacity>
                          ))
                        )}
                      </ScrollView>

                      {/* Bouton pour fermer le dropdown */}
                      <TouchableOpacity
                        style={styles.cityDropdownClose}
                        onPress={() => setShowServiceDropdown(false)}
                      >
                        <Ionicons name="close" size={20} color="#047857" />
                        <Text style={styles.cityDropdownCloseText}>Fermer</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Nombre de copies */}
                <Text style={styles.label}>Nombre de copies *</Text>
                <View>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => {
                      setShowCopiesDropdown(!showCopiesDropdown);
                      setShowCityDropdown(false);
                      setShowServiceDropdown(false);
                    }}
                  >
                    <Text style={styles.pickerButtonTextSelected}>
                      {copies} copie{copies > 1 ? 's' : ''}
                    </Text>
                    <Ionicons
                      name={showCopiesDropdown ? "chevron-up" : "chevron-down"}
                      size={20}
                      color="#047857"
                    />
                  </TouchableOpacity>

                  {/* Dropdown des copies */}
                  {showCopiesDropdown && (
                    <View style={styles.cityDropdown}>
                      <ScrollView style={styles.cityDropdownScroll} nestedScrollEnabled={true}>
                        {[2, 3, 4, 5].map((num) => (
                          <TouchableOpacity
                            key={num}
                            style={styles.copiesOption}
                            onPress={() => {
                              setCopies(num);
                              setShowCopiesDropdown(false);
                            }}
                          >
                            <Ionicons name="documents" size={20} color="#047857" />
                            <Text style={styles.copiesOptionName}>
                              {num} copie{num > 1 ? 's' : ''}
                            </Text>
                            {copies === num && (
                              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      {/* Bouton pour fermer le dropdown */}
                      <TouchableOpacity
                        style={styles.cityDropdownClose}
                        onPress={() => setShowCopiesDropdown(false)}
                      >
                        <Ionicons name="close" size={20} color="#047857" />
                        <Text style={styles.cityDropdownCloseText}>Fermer</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Prix du document */}
                <Text style={styles.label}>Coût du document</Text>
                <View style={styles.priceDisplay}>
                  <Ionicons name="cash" size={20} color="#047857" />
                  <Text style={styles.priceDisplayValue}>{documentsOnlyPrice.toLocaleString()} FCFA</Text>
                </View>
                <Text style={styles.priceNote}>* Les frais de prestation seront ajoutés plus tard</Text>
              </SectionCard>

              <Divider style={styles.divider} />

              {/* Formulaires spécifiques */}
              {documentCategory === 'naissance' && renderNaissanceForm()}
              {documentCategory === 'certificat' && renderCertificatForm()}
              {documentCategory === 'mariage' && renderMariageForm()}

              <Divider style={styles.divider} />

              {/* Pièces justificatives */}
              <SectionCard title="Pièces justificatives" icon="image">
                <PhotoUploader onImagesChange={setImages} />
              </SectionCard>

              {/* Bouton Suivant */}
              <View style={styles.section}>
                <PaperButton
                  mode="contained"
                  onPress={handleNextStep}
                  disabled={!city || !serviceAdmin || !areRequiredFieldsFilled()}
                  style={[
                    styles.submitButton,
                    (!city || !serviceAdmin || !areRequiredFieldsFilled()) && styles.submitButtonDisabled
                  ]}
                  contentStyle={styles.submitButtonContent}
                  buttonColor={(!city || !serviceAdmin || !areRequiredFieldsFilled()) ? "#9ca3af" : "#047857"}
                  labelStyle={(!city || !serviceAdmin || !areRequiredFieldsFilled()) && styles.submitButtonLabelDisabled}
                >
                  Suivant →
                </PaperButton>
              </View>
            </>
          )}

          {/* ÉTAPE 2 : Livraison */}
          {currentStep === 2 && (
            <>
              {/* Bouton Retour */}
              <TouchableOpacity onPress={() => { setCurrentStep(1); scrollViewRef.current?.scrollTo({ y: 0, animated: true }); }} style={styles.backToStep1}>
                <Ionicons name="arrow-back" size={20} color="#047857" />
                <Text style={styles.backToStep1Text}>Retour aux informations</Text>
              </TouchableOpacity>

              {/* SECTION 1 : Infos destinataire */}
              <SectionCard title="Informations du destinataire" icon="person">
                <TextInput
                  label="Nom du destinataire *"
                  value={deliveryData.nom_destinataire || ''}
                  onChangeText={(value) => setDeliveryData({ ...deliveryData, nom_destinataire: value })}
                  mode="outlined"
                  style={styles.input}
                  outlineColor="#e5e7eb"
                  activeOutlineColor="#047857"
                />
                <TextInput
                  label="Contact principal *"
                  value={deliveryData.contact1 || ''}
                  onChangeText={(value) => setDeliveryData({ ...deliveryData, contact1: value })}
                  mode="outlined"
                  keyboardType="phone-pad"
                  style={styles.input}
                  placeholder="07 XX XX XX XX"
                  outlineColor="#e5e7eb"
                  activeOutlineColor="#047857"
                />
                <TextInput
                  label="Contact alternatif"
                  value={deliveryData.contact2 || ''}
                  onChangeText={(value) => setDeliveryData({ ...deliveryData, contact2: value })}
                  mode="outlined"
                  keyboardType="phone-pad"
                  style={styles.input}
                  placeholder="Optionnel"
                  outlineColor="#e5e7eb"
                  activeOutlineColor="#047857"
                />
              </SectionCard>

              <Divider style={styles.divider} />

              {/* SECTION 2 : Mode de récupération (pickup vs delivery) */}
              <SectionCard title="Mode de recuperation" icon="cube">
                <View style={styles.radioGroup}>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setDeliveryMode('pickup')}
                  >
                    <RadioButton.Android
                      value="pickup"
                      status={deliveryMode === 'pickup' ? 'checked' : 'unchecked'}
                      onPress={() => setDeliveryMode('pickup')}
                      color="#047857"
                    />
                    <View style={styles.radioContent}>
                      <Text style={styles.radioLabel}>
                        Recuperer a la {serviceAdmin === 'sous_prefecture' ? 'sous-prefecture' : 'mairie'} de {city}
                      </Text>
                      <Text style={styles.radioDescription}>Le plus economique - Frais de prestation uniquement</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setDeliveryMode('delivery')}
                  >
                    <RadioButton.Android
                      value="delivery"
                      status={deliveryMode === 'delivery' ? 'checked' : 'unchecked'}
                      onPress={() => setDeliveryMode('delivery')}
                      color="#047857"
                    />
                    <View style={styles.radioContent}>
                      <Text style={styles.radioLabel}>Se faire livrer</Text>
                      <Text style={styles.radioDescription}>Livraison express ou expedition vers votre destination</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </SectionCard>

              {/* Si pickup : PriceCard directement */}
              {deliveryMode === 'pickup' && (
                <>
                  <Divider style={styles.divider} />
                  {billingDetails && <PriceCard billingDetails={billingDetails} />}
                </>
              )}

              {/* Si delivery : continuer le parcours */}
              {deliveryMode === 'delivery' && (
                <>
                  <Divider style={styles.divider} />

                  {/* SECTION 3 : Destination */}
                  <SectionCard title="Destination" icon="location">
                    <TextInput
                      label="Ville de destination *"
                      value={deliveryData.ville_destination || ''}
                      onChangeText={(value) => {
                        setDeliveryData({ ...deliveryData, ville_destination: value });
                        setSelectedExpressCommune('');
                        setSelectedExpressSector(null);
                      }}
                      mode="outlined"
                      style={styles.input}
                      placeholder="Ex: Cocody, Abobo, Bouake..."
                      outlineColor="#e5e7eb"
                      activeOutlineColor="#047857"
                    />
                  </SectionCard>

                  {/* SECTION 4 : Options contextuelles */}
                  {deliveryScenario && (
                    <>
                      <Divider style={styles.divider} />

                      {/* Case A: src+dest Abidjan → Express automatique */}
                      {deliveryScenario === 'case_a' && (
                        <SectionCard title="Livraison express" icon="flash">
                          <Text style={styles.infoText}>
                            Livraison express automatique - Votre document sera livre directement a votre adresse a Abidjan.
                          </Text>

                          {/* Dropdown Commune */}
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 }}>Commune de livraison *</Text>
                          <TouchableOpacity
                            style={{
                              borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12,
                              backgroundColor: '#fff', marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                            }}
                            onPress={() => setShowExpressCommuneDropdown(!showExpressCommuneDropdown)}
                          >
                            <Text style={{ color: selectedExpressCommune ? '#111827' : '#9ca3af', fontSize: 14 }}>
                              {selectedExpressCommune || 'Choisir une commune...'}
                            </Text>
                            <Ionicons name={showExpressCommuneDropdown ? 'chevron-up' : 'chevron-down'} size={18} color="#6b7280" />
                          </TouchableOpacity>

                          {showExpressCommuneDropdown && (
                            <View style={{ backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8, maxHeight: 200 }}>
                              <ScrollView nestedScrollEnabled>
                                {expressCommunesData.map((item) => (
                                  <TouchableOpacity
                                    key={item.commune}
                                    style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}
                                    onPress={() => {
                                      setSelectedExpressCommune(item.commune);
                                      setSelectedExpressSector(null);
                                      setDeliveryData({ ...deliveryData, ville_destination: item.commune });
                                      setShowExpressCommuneDropdown(false);
                                    }}
                                  >
                                    <Text style={{ fontSize: 14, color: '#111827', fontWeight: selectedExpressCommune === item.commune ? '700' : '400' }}>
                                      {item.commune} ({item.sectors.length} secteur{item.sectors.length > 1 ? 's' : ''})
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          )}

                          {/* Dropdown Secteur */}
                          {selectedExpressCommune && (
                            <>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 4 }}>Secteur de livraison *</Text>
                              <TouchableOpacity
                                style={{
                                  borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12,
                                  backgroundColor: '#fff', marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                                }}
                                onPress={() => setShowExpressSectorDropdown(!showExpressSectorDropdown)}
                              >
                                <Text style={{ color: selectedExpressSector ? '#111827' : '#9ca3af', fontSize: 14 }}>
                                  {selectedExpressSector?.name || 'Choisir un secteur...'}
                                </Text>
                                <Ionicons name={showExpressSectorDropdown ? 'chevron-up' : 'chevron-down'} size={18} color="#6b7280" />
                              </TouchableOpacity>

                              {showExpressSectorDropdown && (
                                <View style={{ backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 }}>
                                  {expressCommunesData
                                    .find(c => c.commune === selectedExpressCommune)
                                    ?.sectors.map((sector) => (
                                      <TouchableOpacity
                                        key={sector.id}
                                        style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}
                                        onPress={() => {
                                          setSelectedExpressSector(sector);
                                          setShowExpressSectorDropdown(false);
                                        }}
                                      >
                                        <Text style={{ fontSize: 14, color: '#111827', fontWeight: selectedExpressSector?.id === sector.id ? '700' : '400' }}>
                                          {sector.name}
                                        </Text>
                                      </TouchableOpacity>
                                    ))}
                                </View>
                              )}
                            </>
                          )}

                          {/* Prix express dynamique */}
                          {expressPrice !== null && selectedExpressSector && (
                            <View style={{
                              backgroundColor: '#ecfdf5', borderRadius: 10, padding: 12, marginTop: 4,
                              borderWidth: 1, borderColor: '#a7f3d0',
                            }}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: '#047857', marginBottom: 4 }}>
                                Livraison express : {expressPrice.toLocaleString()} FCFA
                              </Text>
                              <Text style={{ fontSize: 11, color: '#6b7280' }}>
                                Distance estimee : ~{expressDistanceKm} km (depuis la mairie de {city})
                              </Text>
                            </View>
                          )}
                        </SectionCard>
                      )}

                      {/* Case B: dest Abidjan, src intérieur → Choix express ou gare */}
                      {deliveryScenario === 'case_b' && (
                        <SectionCard title="Options de livraison" icon="options">
                          <View style={styles.radioGroup}>
                            <TouchableOpacity
                              style={styles.radioOption}
                              onPress={() => {
                                setDeliveryData({ ...deliveryData, moyen_recuperation: 'livraison_express', moyen_expedition: '' });
                                setSelectedExpressCommune('');
                                setSelectedExpressSector(null);
                              }}
                            >
                              <RadioButton.Android
                                value="livraison_express"
                                status={deliveryData.moyen_recuperation === 'livraison_express' ? 'checked' : 'unchecked'}
                                onPress={() => {
                                  setDeliveryData({ ...deliveryData, moyen_recuperation: 'livraison_express', moyen_expedition: '' });
                                  setSelectedExpressCommune('');
                                  setSelectedExpressSector(null);
                                }}
                                color="#047857"
                              />
                              <View style={styles.radioContent}>
                                <Text style={styles.radioLabel}>Livraison Express</Text>
                                <Text style={styles.radioDescription}>Livraison directe a votre adresse a Abidjan</Text>
                              </View>
                            </TouchableOpacity>

                            {/* Express sélectionné : dropdowns commune/secteur */}
                            {deliveryData.moyen_recuperation === 'livraison_express' && expressCommunesData.length > 0 && (
                              <View style={{ marginLeft: 40, marginTop: 8 }}>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 }}>Commune de livraison *</Text>
                                <TouchableOpacity
                                  style={{
                                    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12,
                                    backgroundColor: '#fff', marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                                  }}
                                  onPress={() => setShowExpressCommuneDropdown(!showExpressCommuneDropdown)}
                                >
                                  <Text style={{ color: selectedExpressCommune ? '#111827' : '#9ca3af', fontSize: 14 }}>
                                    {selectedExpressCommune || 'Choisir une commune...'}
                                  </Text>
                                  <Ionicons name={showExpressCommuneDropdown ? 'chevron-up' : 'chevron-down'} size={18} color="#6b7280" />
                                </TouchableOpacity>

                                {showExpressCommuneDropdown && (
                                  <View style={{ backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8, maxHeight: 200 }}>
                                    <ScrollView nestedScrollEnabled>
                                      {expressCommunesData.map((item) => (
                                        <TouchableOpacity
                                          key={item.commune}
                                          style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}
                                          onPress={() => {
                                            setSelectedExpressCommune(item.commune);
                                            setSelectedExpressSector(null);
                                            setDeliveryData({ ...deliveryData, ville_destination: item.commune });
                                            setShowExpressCommuneDropdown(false);
                                          }}
                                        >
                                          <Text style={{ fontSize: 14, color: '#111827', fontWeight: selectedExpressCommune === item.commune ? '700' : '400' }}>
                                            {item.commune} ({item.sectors.length} secteur{item.sectors.length > 1 ? 's' : ''})
                                          </Text>
                                        </TouchableOpacity>
                                      ))}
                                    </ScrollView>
                                  </View>
                                )}

                                {selectedExpressCommune && (
                                  <>
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 4 }}>Secteur de livraison *</Text>
                                    <TouchableOpacity
                                      style={{
                                        borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12,
                                        backgroundColor: '#fff', marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                                      }}
                                      onPress={() => setShowExpressSectorDropdown(!showExpressSectorDropdown)}
                                    >
                                      <Text style={{ color: selectedExpressSector ? '#111827' : '#9ca3af', fontSize: 14 }}>
                                        {selectedExpressSector?.name || 'Choisir un secteur...'}
                                      </Text>
                                      <Ionicons name={showExpressSectorDropdown ? 'chevron-up' : 'chevron-down'} size={18} color="#6b7280" />
                                    </TouchableOpacity>

                                    {showExpressSectorDropdown && (
                                      <View style={{ backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 }}>
                                        {expressCommunesData
                                          .find(c => c.commune === selectedExpressCommune)
                                          ?.sectors.map((sector) => (
                                            <TouchableOpacity
                                              key={sector.id}
                                              style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}
                                              onPress={() => {
                                                setSelectedExpressSector(sector);
                                                setShowExpressSectorDropdown(false);
                                              }}
                                            >
                                              <Text style={{ fontSize: 14, color: '#111827', fontWeight: selectedExpressSector?.id === sector.id ? '700' : '400' }}>
                                                {sector.name}
                                              </Text>
                                            </TouchableOpacity>
                                          ))}
                                      </View>
                                    )}
                                  </>
                                )}

                                {expressPrice !== null && selectedExpressSector && (
                                  <View style={{
                                    backgroundColor: '#ecfdf5', borderRadius: 10, padding: 12, marginTop: 4,
                                    borderWidth: 1, borderColor: '#a7f3d0',
                                  }}>
                                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#047857', marginBottom: 4 }}>
                                      Livraison express : {expressPrice.toLocaleString()} FCFA
                                    </Text>
                                    <Text style={{ fontSize: 11, color: '#6b7280' }}>
                                      Distance estimee : ~{expressDistanceKm} km
                                    </Text>
                                  </View>
                                )}
                              </View>
                            )}

                            <TouchableOpacity
                              style={styles.radioOption}
                              onPress={() => {
                                setDeliveryData({ ...deliveryData, moyen_recuperation: 'moi_meme_gare', moyen_expedition: '' });
                                setSelectedExpressCommune('');
                                setSelectedExpressSector(null);
                              }}
                            >
                              <RadioButton.Android
                                value="moi_meme_gare"
                                status={deliveryData.moyen_recuperation === 'moi_meme_gare' ? 'checked' : 'unchecked'}
                                onPress={() => {
                                  setDeliveryData({ ...deliveryData, moyen_recuperation: 'moi_meme_gare', moyen_expedition: '' });
                                  setSelectedExpressCommune('');
                                  setSelectedExpressSector(null);
                                }}
                                color="#047857"
                              />
                              <View style={styles.radioContent}>
                                <Text style={styles.radioLabel}>Recuperation a la gare</Text>
                                <Text style={styles.radioDescription}>Frais de prestation + Frais d'expedition</Text>
                              </View>
                            </TouchableOpacity>
                          </View>
                        </SectionCard>
                      )}

                      {/* Case C: dest intérieur → Expédition obligatoire */}
                      {deliveryScenario === 'case_c' && (
                        <>
                          {/* Bannière pickup auto si source = Abidjan */}
                          {isAbidjanCommune(city) && (
                            <SectionCard title="Recuperation automatique" icon="car">
                              <View style={{
                                backgroundColor: '#eff6ff', borderRadius: 10, padding: 12,
                                borderWidth: 1, borderColor: '#bfdbfe',
                              }}>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1d4ed8', marginBottom: 4 }}>
                                  Recuperation automatique par livreur
                                </Text>
                                <Text style={{ fontSize: 12, color: '#6b7280', lineHeight: 18 }}>
                                  Notre livreur recupere votre document a la mairie de {city} et le depose a la gare d'Adjame pour expedition vers {deliveryData.ville_destination}.
                                </Text>
                                {pickupToGarePrice !== null && (
                                  <View style={{
                                    backgroundColor: '#ecfdf5', borderRadius: 8, padding: 8, marginTop: 8,
                                    borderWidth: 1, borderColor: '#a7f3d0',
                                  }}>
                                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#047857' }}>
                                      Frais de recuperation : {pickupToGarePrice.toLocaleString()} FCFA
                                    </Text>
                                    <Text style={{ fontSize: 11, color: '#6b7280' }}>
                                      Distance estimee : ~{pickupToGareDistanceKm} km (mairie de {city} → gare d'Adjame)
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </SectionCard>
                          )}
                        </>
                      )}

                      {/* SECTION 5 : Mode d'expédition (quand needsExpeditionSection = true) */}
                      {needsExpeditionSection && (
                        <>
                          <Divider style={styles.divider} />
                          <SectionCard title="Mode d'expedition" icon="car">
                            <Text style={styles.infoText}>
                              Comment vos documents arriveront-ils ? Precisez la compagnie qui relie directement "{city}" a "{deliveryData.ville_destination || 'votre destination'}".
                            </Text>

                            <View style={styles.radioGroup}>
                              <TouchableOpacity
                                style={styles.radioOption}
                                onPress={() => setDeliveryData({ ...deliveryData, moyen_expedition: 'utb' })}
                              >
                                <RadioButton.Android
                                  value="utb"
                                  status={deliveryData.moyen_expedition === 'utb' ? 'checked' : 'unchecked'}
                                  onPress={() => setDeliveryData({ ...deliveryData, moyen_expedition: 'utb' })}
                                  color="#047857"
                                />
                                <View style={styles.radioContent}>
                                  <Text style={styles.radioLabel}>UTB (Union des Transporteurs de Bouake)</Text>
                                  <Text style={styles.radioDescription}>Tarif fixe garanti - Reseau national fiable</Text>
                                </View>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.radioOption}
                                onPress={() => setDeliveryData({ ...deliveryData, moyen_expedition: 'transport_classique' })}
                              >
                                <RadioButton.Android
                                  value="transport_classique"
                                  status={deliveryData.moyen_expedition === 'transport_classique' ? 'checked' : 'unchecked'}
                                  onPress={() => setDeliveryData({ ...deliveryData, moyen_expedition: 'transport_classique' })}
                                  color="#047857"
                                />
                                <View style={styles.radioContent}>
                                  <Text style={styles.radioLabel}>Autre compagnie de transport</Text>
                                  <Text style={styles.radioDescription}>Tarif estimatif 1000 FCFA - Ajustement possible selon disponibilite</Text>
                                </View>
                              </TouchableOpacity>

                              {deliveryData.moyen_expedition === 'transport_classique' && (
                                <>
                                  <TextInput
                                    label="Nom de la compagnie *"
                                    value={deliveryData.preference_transport || ''}
                                    onChangeText={(value) => setDeliveryData({ ...deliveryData, preference_transport: value })}
                                    mode="outlined"
                                    style={styles.input}
                                    placeholder="Ex: SBTA, CATRANS, etc."
                                    outlineColor="#e5e7eb"
                                    activeOutlineColor="#047857"
                                  />
                                  {deliveryData.preference_transport && (
                                    <View style={styles.warningBox}>
                                      <Ionicons name="information-circle" size={20} color="#d97706" />
                                      <View style={styles.warningContent}>
                                        <Text style={styles.warningTitle}>Important</Text>
                                        <Text style={styles.warningText}>
                                          Le tarif affiche (1000 FCFA) est estimatif. Si <Text style={styles.warningTextBold}>{deliveryData.preference_transport}</Text> n'existe pas a <Text style={styles.warningTextBold}>{deliveryData.ville_destination || 'votre destination'}</Text> ou applique un tarif superieur, vous serez contacte pour validation et devrez completer la difference avant l'expedition.
                                        </Text>
                                      </View>
                                    </View>
                                  )}
                                </>
                              )}

                              {/* Expédition par Abidjan - uniquement si les 2 villes sont hors Abidjan */}
                              {!isAbidjanCommune(city) && deliveryData.ville_destination && !isAbidjanCommune(deliveryData.ville_destination) && (
                                <TouchableOpacity
                                  style={styles.radioOption}
                                  onPress={() => setDeliveryData({ ...deliveryData, moyen_expedition: 'expedition_abidjan' })}
                                >
                                  <RadioButton.Android
                                    value="expedition_abidjan"
                                    status={deliveryData.moyen_expedition === 'expedition_abidjan' ? 'checked' : 'unchecked'}
                                    onPress={() => setDeliveryData({ ...deliveryData, moyen_expedition: 'expedition_abidjan' })}
                                    color="#047857"
                                  />
                                  <View style={styles.radioContent}>
                                    <Text style={styles.radioLabel}>Expedition par Abidjan</Text>
                                    <Text style={styles.radioDescription}>Transit securise via la capitale - Tarif fixe</Text>
                                  </View>
                                </TouchableOpacity>
                              )}
                            </View>
                          </SectionCard>
                        </>
                      )}

                      {/* SECTION 6 : Récapitulatif */}
                      <Divider style={styles.divider} />
                      {billingDetails && <PriceCard billingDetails={billingDetails} />}
                    </>
                  )}
                </>
              )}

              {/* Bouton de paiement */}
              <View style={styles.section}>
                <PaperButton
                  mode="contained"
                  onPress={handleSubmit}
                  loading={loading}
                  disabled={loading || !isStep2Valid}
                  style={[
                    styles.submitButton,
                    (loading || !isStep2Valid) && styles.submitButtonDisabled
                  ]}
                  contentStyle={styles.submitButtonContent}
                  buttonColor={(loading || !isStep2Valid) ? "#9ca3af" : "#047857"}
                  labelStyle={(loading || !isStep2Valid) && styles.submitButtonLabelDisabled}
                >
                  Passer au paiement
                </PaperButton>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

    </View>
  );

  // Fonction pour rendre le formulaire actes de naissance
  function renderNaissanceForm() {
    if (documentType === 'declaration_naissance') {
      return (
        <>
          <SectionCard title="Informations de l'enfant" icon="person-add">
            <TextInput label="Nom et prénoms de l'enfant *" value={formData.nom_enfant || ''} onChangeText={(v) => setFormData({ ...formData, nom_enfant: v })} mode="outlined" style={styles.input} outlineColor="#e5e7eb" activeOutlineColor="#047857" />
            <TextInput label="Sexe *" value={formData.sexe_enfant || ''} onChangeText={(v) => setFormData({ ...formData, sexe_enfant: v })} mode="outlined" style={styles.input} placeholder="Masculin / Féminin" outlineColor="#e5e7eb" activeOutlineColor="#047857" />
            <TextInput label="Date de naissance *" value={formData.date_naissance_enfant || ''} onChangeText={(v) => setFormData({ ...formData, date_naissance_enfant: v })} mode="outlined" style={styles.input} placeholder="JJ/MM/AAAA" outlineColor="#e5e7eb" activeOutlineColor="#047857" />
            <TextInput label="Lieu de naissance *" value={formData.lieu_naissance_enfant || ''} onChangeText={(v) => setFormData({ ...formData, lieu_naissance_enfant: v })} mode="outlined" style={styles.input} outlineColor="#e5e7eb" activeOutlineColor="#047857" />
          </SectionCard>
          <Divider style={styles.divider} />
          <SectionCard title="Informations du père" icon="person">
            <TextInput label="Nom et prénoms du père *" value={formData.nom_pere || ''} onChangeText={(v) => setFormData({ ...formData, nom_pere: v })} mode="outlined" style={styles.input} outlineColor="#e5e7eb" activeOutlineColor="#047857" />
            <TextInput label="Profession du père" value={formData.profession_pere || ''} onChangeText={(v) => setFormData({ ...formData, profession_pere: v })} mode="outlined" style={styles.input} outlineColor="#e5e7eb" activeOutlineColor="#047857" />
          </SectionCard>
          <Divider style={styles.divider} />
          <SectionCard title="Informations de la mère" icon="person">
            <TextInput label="Nom et prénoms de la mère *" value={formData.nom_mere || ''} onChangeText={(v) => setFormData({ ...formData, nom_mere: v })} mode="outlined" style={styles.input} outlineColor="#e5e7eb" activeOutlineColor="#047857" />
            <TextInput label="Profession de la mère" value={formData.profession_mere || ''} onChangeText={(v) => setFormData({ ...formData, profession_mere: v })} mode="outlined" style={styles.input} outlineColor="#e5e7eb" activeOutlineColor="#047857" />
          </SectionCard>
        </>
      );
    }

    return (
      <SectionCard title="Informations du document" icon="document-text">
        <TextInput label="Nom complet *" value={formData.nom_complet || ''} onChangeText={(v) => setFormData({ ...formData, nom_complet: v })} mode="outlined" style={styles.input} placeholder="Nom et prénoms complets" outlineColor="#e5e7eb" activeOutlineColor="#047857" />
        <TextInput label="Numéro d'acte de naissance *" value={formData.numero_acte_naissance || ''} onChangeText={(v) => setFormData({ ...formData, numero_acte_naissance: v })} mode="outlined" style={styles.input} outlineColor="#e5e7eb" activeOutlineColor="#047857" />
        {documentType === 'extrait_acte_naissance' && (
          <TouchableOpacity
            style={styles.mariageCheckbox}
            onPress={() => setFormData({ ...formData, en_vue_mariage: formData.en_vue_mariage === 'true' ? 'false' : 'true' })}
            activeOpacity={0.7}
          >
            <View style={styles.goldAccent} />
            <View style={styles.checkboxRow}>
              <RadioButton.Android
                value="true"
                status={formData.en_vue_mariage === 'true' ? 'checked' : 'unchecked'}
                onPress={() => setFormData({ ...formData, en_vue_mariage: formData.en_vue_mariage === 'true' ? 'false' : 'true' })}
                color="#047857"
              />
              <Text style={styles.checkboxLabel}>💍 En vue de mariage</Text>
            </View>
          </TouchableOpacity>
        )}
      </SectionCard>
    );
  }

  function renderCertificatForm() {
    return (
      <SectionCard title="Informations personnelles" icon="person-circle">
        <TextInput label="Nom complet *" value={formData.nom_complet || ''} onChangeText={(v) => setFormData({ ...formData, nom_complet: v })} mode="outlined" style={styles.input} placeholder="Nom et prénoms complets" outlineColor="#e5e7eb" activeOutlineColor="#047857" />
        {documentType === 'certificat_residence' && (
          <TextInput label="Adresse de résidence *" value={formData.adresse_residence || ''} onChangeText={(v) => setFormData({ ...formData, adresse_residence: v })} mode="outlined" style={styles.input} multiline numberOfLines={2} outlineColor="#e5e7eb" activeOutlineColor="#047857" />
        )}
        {(documentType === 'certificat_celibat' || documentType === 'certificat_non_divorce') && (
          <TextInput label="Numéro d'acte de naissance" value={formData.numero_acte_naissance || ''} onChangeText={(v) => setFormData({ ...formData, numero_acte_naissance: v })} mode="outlined" style={styles.input} outlineColor="#e5e7eb" activeOutlineColor="#047857" />
        )}
      </SectionCard>
    );
  }

  function renderMariageForm() {
    return (
      <SectionCard title="Informations du document" icon="heart">
        <TextInput label="Nom complet *" value={formData.nom_complet || ''} onChangeText={(v) => setFormData({ ...formData, nom_complet: v })} mode="outlined" style={styles.input} placeholder="Nom et prénoms complets" outlineColor="#e5e7eb" activeOutlineColor="#047857" />
        <TextInput label="Numéro d'acte de mariage *" value={formData.numero_acte_mariage || ''} onChangeText={(v) => setFormData({ ...formData, numero_acte_mariage: v })} mode="outlined" style={styles.input} outlineColor="#e5e7eb" activeOutlineColor="#047857" />
      </SectionCard>
    );
  }
}

// Composant SectionCard
function SectionCard({ title, icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.goldAccent} />
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={20} color="#047857" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// Composant PriceCard
function PriceCard({ billingDetails }: { billingDetails: any }) {
  return (
    <View style={styles.priceCard}>
      <View style={styles.goldAccent} />
      <Text style={styles.priceCardTitle}>Récapitulatif final</Text>
      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>{billingDetails.documents[0].document_name} ({billingDetails.documents[0].copies} copie{billingDetails.documents[0].copies > 1 ? 's' : ''})</Text>
        <Text style={styles.priceValue}>{billingDetails.payment_breakdown.documents_subtotal.toLocaleString()} FCFA</Text>
      </View>
      {billingDetails.express_delivery && (
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>{billingDetails.express_delivery.description}</Text>
          <Text style={styles.priceValue}>{billingDetails.payment_breakdown.express_fee.toLocaleString()} FCFA</Text>
        </View>
      )}
      {billingDetails.shipping && (
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>{billingDetails.shipping.description}</Text>
          <Text style={styles.priceValue}>{billingDetails.payment_breakdown.shipping_fee.toLocaleString()} FCFA</Text>
        </View>
      )}
      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>{billingDetails.prestation.description}</Text>
        <Text style={styles.priceValue}>{billingDetails.payment_breakdown.prestation_fee.toLocaleString()} FCFA</Text>
      </View>
      <Divider style={styles.priceDivider} />
      <View style={styles.priceRow}>
        <Text style={styles.totalLabel}>Total à payer</Text>
        <Text style={styles.totalValue}>{billingDetails.total_amount.toLocaleString()} FCFA</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0fdf4'
  },
  header: {
    backgroundColor: '#047857',
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    borderBottomWidth: 3,
    borderBottomColor: '#d4af37'
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d4af37',
    elevation: 4,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4
  },
  headerContent: {
    flex: 1,
    marginLeft: 16
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    marginTop: 3
  },
  progressCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 18,
    padding: 24,
    elevation: 6,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.1)'
  },
  progressIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  stepContainer: {
    alignItems: 'center'
  },
  stepCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 3,
    borderColor: '#e5e7eb'
  },
  stepCircleActive: {
    backgroundColor: '#047857',
    borderColor: '#d4af37',
    elevation: 6,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8
  },
  stepNumber: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '700'
  },
  stepNumberActive: {
    color: '#ffffff'
  },
  stepLabel: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500'
  },
  stepLabelActive: {
    color: '#047857',
    fontWeight: '700'
  },
  stepDivider: {
    width: 60,
    height: 4,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
    borderRadius: 2
  },
  stepDividerActive: {
    backgroundColor: '#d4af37',
    elevation: 2,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3
  },
  scrollContent: {
    paddingBottom: 40
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    padding: 24,
    elevation: 5,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.08)',
    overflow: 'hidden'
  },
  goldAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: '#d4af37',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 10,
    color: '#047857',
    letterSpacing: 0.2
  },
  input: {
    marginBottom: 18,
    backgroundColor: '#f8fffe',
    fontSize: 15,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(4, 120, 87, 0.15)'
  },
  label: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 12,
    letterSpacing: 0.3
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
    backgroundColor: '#ecfdf5',
    elevation: 3,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6
  },
  pickerButtonTextSelected: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '500'
  },
  pickerButtonTextPlaceholder: {
    color: '#9ca3af',
    fontSize: 16
  },
  priceDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#6ee7b7',
    elevation: 5,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8
  },
  priceDisplayValue: {
    color: '#065f46',
    fontSize: 26,
    fontWeight: '900',
    marginLeft: 12,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(16, 185, 129, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3
  },
  priceNote: {
    color: '#047857',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 10,
    backgroundColor: '#ecfdf5',
    padding: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
    fontWeight: '600'
  },
  divider: {
    marginVertical: 12,
    backgroundColor: '#d1fae5',
    height: 1.5
  },
  section: {
    padding: 20
  },
  mariageCheckbox: {
    backgroundColor: '#fef3c7',
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
    borderWidth: 2.5,
    borderColor: '#fbbf24',
    elevation: 4,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    overflow: 'hidden'
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  checkboxLabel: {
    color: '#b45309',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 10,
    letterSpacing: 0.3
  },
  backToStep1: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 20,
    backgroundColor: '#d1fae5',
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#6ee7b7',
    elevation: 4,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6
  },
  backToStep1Text: {
    color: '#047857',
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 10,
    letterSpacing: 0.3
  },
  radioGroup: {
    marginTop: 10
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 2.5,
    borderColor: '#86efac',
    elevation: 4,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6
  },
  radioContent: {
    flex: 1,
    marginLeft: 10
  },
  radioLabel: {
    color: '#047857',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 5,
    letterSpacing: 0.2
  },
  radioDescription: {
    color: '#059669',
    fontSize: 13,
    opacity: 0.85,
    lineHeight: 18
  },
  infoText: {
    color: '#047857',
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 20,
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981'
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    marginBottom: 18,
    borderWidth: 2,
    borderColor: '#fbbf24',
    gap: 12,
    alignItems: 'flex-start'
  },
  warningContent: {
    flex: 1
  },
  warningTitle: {
    color: '#b45309',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.2
  },
  warningText: {
    color: '#92400e',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500'
  },
  warningTextBold: {
    fontWeight: '800',
    color: '#b45309'
  },
  priceCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    padding: 24,
    elevation: 8,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    borderWidth: 2,
    borderColor: '#fef3c7',
    overflow: 'hidden'
  },
  priceCardTitle: {
    color: '#047857',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 18,
    letterSpacing: 0.3
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingVertical: 4
  },
  priceLabel: {
    color: '#6b7280',
    fontSize: 14,
    flex: 1,
    lineHeight: 20
  },
  priceValue: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 12
  },
  priceDivider: {
    backgroundColor: '#d4af37',
    height: 2.5,
    marginVertical: 14,
    borderRadius: 2
  },
  totalLabel: {
    color: '#047857',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  totalValue: {
    color: '#047857',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  submitButton: {
    marginTop: 16,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    backgroundColor: '#047857',
    borderWidth: 2,
    borderColor: '#d4af37'
  },
  submitButtonDisabled: {
    elevation: 2,
    shadowColor: '#9ca3af',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    backgroundColor: '#e5e7eb',
    borderColor: '#d1d5db',
    opacity: 0.6
  },
  submitButtonLabelDisabled: {
    color: '#6b7280'
  },
  submitButtonContent: {
    paddingVertical: 14
  },
  cityDropdown: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#6ee7b7',
    elevation: 8,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    maxHeight: 300,
    zIndex: 1000
  },
  cityDropdownScroll: {
    maxHeight: 250
  },
  cityDropdownEmpty: {
    padding: 24,
    alignItems: 'center'
  },
  cityDropdownEmptyTitle: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center'
  },
  cityDropdownEmptyText: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20
  },
  inputError: {
    borderColor: '#dc2626',
    borderWidth: 2
  },
  cityNotAvailableMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#fecaca',
    gap: 10
  },
  cityNotAvailableText: {
    flex: 1,
    color: '#dc2626',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500'
  },
  cityDropdownClose: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderTopWidth: 2,
    borderTopColor: '#d1fae5',
    backgroundColor: '#ecfdf5'
  },
  cityDropdownCloseText: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6
  },
  serviceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    borderColor: '#d1fae5',
    elevation: 2,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    gap: 12
  },
  serviceOptionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#047857',
    letterSpacing: 0.3,
    flex: 1
  },
  copiesOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    borderColor: '#d1fae5',
    elevation: 2,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    gap: 12
  },
  copiesOptionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#047857',
    letterSpacing: 0.3,
    flex: 1
  },
  cityOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    borderColor: '#d1fae5',
    elevation: 2,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3
  },
  cityOptionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#047857',
    letterSpacing: 0.3
  },
  cityOptionInfo: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
});
