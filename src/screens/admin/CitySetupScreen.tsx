import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { toast } from '../../stores/toastStore';
import Loading from '../../components/ui/Loading';

// Types
interface City {
  id: string;
  name: string;
  is_active: boolean;
  shipping_cost: number;
  document_prices: Record<string, Record<string, number>>;
}

interface ServiceType {
  id: string;
  key: string;
  label: string;
  icon: string;
  color: string;
  is_active: boolean;
}

interface DocumentType {
  id: string;
  key: string;
  label: string;
  is_active: boolean;
}

interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: string;
}

interface Delegate {
  id: string;
  name: string;
  city: string;
  service_type: string;
  is_active: boolean;
}

// Étapes du workflow
type Step = 'city' | 'services' | 'pricing' | 'delegate' | 'summary';

const STEPS: { key: Step; title: string; icon: string }[] = [
  { key: 'city', title: 'Ville', icon: 'location' },
  { key: 'services', title: 'Services', icon: 'briefcase' },
  { key: 'pricing', title: 'Tarifs', icon: 'cash' },
  { key: 'delegate', title: 'Délégué', icon: 'person' },
  { key: 'summary', title: 'Résumé', icon: 'checkmark-circle' },
];

export default function CitySetupScreen({ navigation, route }: any) {
  // État global
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>('city');

  // Données de référence
  const [cities, setCities] = useState<City[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [existingDelegates, setExistingDelegates] = useState<Delegate[]>([]);

  // Données du formulaire
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [newCityName, setNewCityName] = useState('');
  const [isNewCity, setIsNewCity] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [shippingCost, setShippingCost] = useState('2000');
  const [prices, setPrices] = useState<Record<string, Record<string, string>>>({});

  // Délégué
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [delegatePhone, setDelegatePhone] = useState('');
  const [delegateMobileMoney, setDelegateMobileMoney] = useState('');

  // Charger les données initiales
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Charger villes, services et documents en parallèle
      const [citiesRes, servicesRes, docsRes, delegatesRes] = await Promise.all([
        supabase.from('cities').select('*').order('name'),
        supabase.from('service_types').select('*').eq('is_active', true).order('display_order'),
        supabase.from('document_types').select('*').eq('is_active', true).order('display_order'),
        supabase.from('delegates').select('*').eq('is_active', true),
      ]);

      if (citiesRes.data) setCities(citiesRes.data);
      if (servicesRes.data) setServiceTypes(servicesRes.data);
      if (docsRes.data) setDocumentTypes(docsRes.data);
      if (delegatesRes.data) setExistingDelegates(delegatesRes.data);

      // Initialiser les prix par défaut
      if (servicesRes.data && docsRes.data) {
        const defaultPrices: Record<string, Record<string, string>> = {};
        servicesRes.data.forEach((service) => {
          defaultPrices[service.key] = {};
          docsRes.data.forEach((doc) => {
            defaultPrices[service.key][doc.key] = '1500';
          });
        });
        setPrices(defaultPrices);
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  // Rechercher un utilisateur
  const handleSearchUser = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
        .neq('role', 'admin')
        .limit(10);

      setSearchResults(data || []);
    } catch (error) {
      console.error('Erreur recherche:', error);
    }
  };

  // Sélectionner un utilisateur
  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setDelegatePhone(user.phone);
    setDelegateMobileMoney(user.phone);
    setSearchResults([]);
    setSearchQuery(user.name);
  };

  // Vérifier si un délégué existe déjà pour cette ville/service
  const checkExistingDelegate = (service: string): Delegate | undefined => {
    const cityName = isNewCity ? newCityName : selectedCity?.name;
    return existingDelegates.find(
      (d) => d.city.toLowerCase() === cityName?.toLowerCase() && d.service_type === service
    );
  };

  // Navigation entre étapes
  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'city':
        return isNewCity ? newCityName.trim().length > 0 : selectedCity !== null;
      case 'services':
        return selectedServices.length > 0;
      case 'pricing':
        // Vérifier qu'au moins un prix est défini pour chaque service sélectionné
        return selectedServices.every((service) =>
          Object.values(prices[service] || {}).some((p) => parseInt(p) > 0)
        );
      case 'delegate':
        return selectedUser !== null && delegateMobileMoney.length > 0;
      default:
        return true;
    }
  };

  const goToNextStep = () => {
    const stepIndex = STEPS.findIndex((s) => s.key === currentStep);
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[stepIndex + 1].key);
    }
  };

  const goToPreviousStep = () => {
    const stepIndex = STEPS.findIndex((s) => s.key === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1].key);
    }
  };

  // Sauvegarder tout
  const handleSave = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      const cityName = isNewCity ? newCityName.trim() : selectedCity?.name;
      let cityId = selectedCity?.id;

      // 1. Créer la ville si nouvelle
      if (isNewCity) {
        const documentPrices: Record<string, Record<string, number>> = {};
        selectedServices.forEach((service) => {
          documentPrices[service] = {};
          Object.entries(prices[service] || {}).forEach(([doc, price]) => {
            documentPrices[service][doc] = parseInt(price) || 0;
          });
        });

        const { data: newCity, error: cityError } = await supabase
          .from('cities')
          .insert({
            name: cityName,
            is_active: true,
            shipping_cost: parseInt(shippingCost) || 2000,
            document_prices: documentPrices,
          })
          .select()
          .single();

        if (cityError) throw cityError;
        cityId = newCity.id;
      } else if (selectedCity) {
        // Mettre à jour les prix de la ville existante
        const documentPrices = { ...(selectedCity.document_prices || {}) };
        selectedServices.forEach((service) => {
          documentPrices[service] = {};
          Object.entries(prices[service] || {}).forEach(([doc, price]) => {
            documentPrices[service][doc] = parseInt(price) || 0;
          });
        });

        const { error: updateError } = await supabase
          .from('cities')
          .update({
            shipping_cost: parseInt(shippingCost) || 2000,
            document_prices: documentPrices,
            is_active: true,
          })
          .eq('id', selectedCity.id);

        if (updateError) throw updateError;
      }

      // 2. Créer le(s) délégué(s) pour chaque service sélectionné
      for (const service of selectedServices) {
        // Vérifier si un délégué existe déjà
        const existing = checkExistingDelegate(service);
        if (existing) {
          console.log(`Délégué existant pour ${service} dans ${cityName}`);
          continue;
        }

        const { error: delegateError } = await supabase.from('delegates').insert({
          user_id: selectedUser.id,
          name: selectedUser.name,
          email: selectedUser.email,
          phone: delegatePhone,
          city: cityName,
          service_type: service,
          service_admin: service,
          mobile_money_contact: delegateMobileMoney,
          is_active: true,
          is_available: true,
          rating: 4.0,
          total_requests: 0,
          total_earnings: 0,
          documents_verified: false,
        });

        if (delegateError) throw delegateError;
      }

      // 3. Mettre à jour le rôle de l'utilisateur
      if (selectedUser.role !== 'delegate' && selectedUser.role !== 'admin') {
        await supabase.from('users').update({ role: 'delegate' }).eq('id', selectedUser.id);
      }

      toast.success('Configuration enregistrée avec succès !');
      navigation.goBack();
    } catch (error: any) {
      console.error('Erreur sauvegarde:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Render étape 1: Ville
  const renderCityStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Sélectionnez ou créez une ville</Text>

      {/* Option nouvelle ville */}
      <TouchableOpacity
        style={[styles.optionCard, isNewCity && styles.optionCardSelected]}
        onPress={() => {
          setIsNewCity(true);
          setSelectedCity(null);
        }}
      >
        <Ionicons name="add-circle" size={24} color={isNewCity ? '#047857' : '#6b7280'} />
        <Text style={[styles.optionText, isNewCity && styles.optionTextSelected]}>
          Créer une nouvelle ville
        </Text>
      </TouchableOpacity>

      {isNewCity && (
        <TextInput
          style={styles.input}
          placeholder="Nom de la ville (ex: Bouaké)"
          value={newCityName}
          onChangeText={setNewCityName}
          autoFocus
        />
      )}

      {/* Séparateur */}
      <View style={styles.separator}>
        <View style={styles.separatorLine} />
        <Text style={styles.separatorText}>ou</Text>
        <View style={styles.separatorLine} />
      </View>

      {/* Liste des villes existantes */}
      <Text style={styles.sectionLabel}>Villes existantes</Text>
      <ScrollView style={styles.cityList} nestedScrollEnabled>
        {cities.map((city) => {
          const delegateCount = existingDelegates.filter(
            (d) => d.city.toLowerCase() === city.name.toLowerCase()
          ).length;

          return (
            <TouchableOpacity
              key={city.id}
              style={[
                styles.cityCard,
                selectedCity?.id === city.id && !isNewCity && styles.cityCardSelected,
              ]}
              onPress={() => {
                setSelectedCity(city);
                setIsNewCity(false);
                setShippingCost(String(city.shipping_cost || 2000));
                // Charger les prix existants
                if (city.document_prices) {
                  const loadedPrices: Record<string, Record<string, string>> = {};
                  Object.entries(city.document_prices).forEach(([service, docs]) => {
                    loadedPrices[service] = {};
                    Object.entries(docs as Record<string, number>).forEach(([doc, price]) => {
                      loadedPrices[service][doc] = String(price);
                    });
                  });
                  setPrices((prev) => ({ ...prev, ...loadedPrices }));
                }
              }}
            >
              <View style={styles.cityInfo}>
                <Text style={styles.cityName}>{city.name}</Text>
                <Text style={styles.cityMeta}>
                  {delegateCount} délégué(s) • {city.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>
              {selectedCity?.id === city.id && !isNewCity && (
                <Ionicons name="checkmark-circle" size={24} color="#047857" />
              )}
            </TouchableOpacity>
          );
        })}
        {cities.length === 0 && (
          <Text style={styles.emptyText}>Aucune ville configurée</Text>
        )}
      </ScrollView>
    </View>
  );

  // Render étape 2: Services
  const renderServicesStep = () => {
    const cityName = isNewCity ? newCityName : selectedCity?.name;

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Services disponibles à {cityName}</Text>
        <Text style={styles.stepDescription}>
          Sélectionnez les services que vous souhaitez proposer dans cette ville
        </Text>

        <View style={styles.servicesGrid}>
          {serviceTypes.map((service) => {
            const isSelected = selectedServices.includes(service.key);
            const existingDelegate = checkExistingDelegate(service.key);

            return (
              <TouchableOpacity
                key={service.id}
                style={[
                  styles.serviceCard,
                  isSelected && styles.serviceCardSelected,
                  existingDelegate && styles.serviceCardDisabled,
                ]}
                onPress={() => {
                  if (existingDelegate) {
                    Alert.alert(
                      'Délégué existant',
                      `${existingDelegate.name} est déjà délégué ${service.label} à ${cityName}`
                    );
                    return;
                  }
                  setSelectedServices((prev) =>
                    isSelected ? prev.filter((s) => s !== service.key) : [...prev, service.key]
                  );
                }}
              >
                <View
                  style={[
                    styles.serviceIcon,
                    { backgroundColor: isSelected ? service.color : '#f3f4f6' },
                  ]}
                >
                  <Ionicons
                    name={service.icon as any}
                    size={28}
                    color={isSelected ? '#fff' : '#6b7280'}
                  />
                </View>
                <Text style={[styles.serviceName, isSelected && styles.serviceNameSelected]}>
                  {service.label}
                </Text>
                {existingDelegate && (
                  <View style={styles.existingBadge}>
                    <Text style={styles.existingBadgeText}>Délégué existant</Text>
                  </View>
                )}
                {isSelected && !existingDelegate && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color="#047857"
                    style={styles.checkIcon}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // Render étape 3: Tarifs
  const renderPricingStep = () => {
    const cityName = isNewCity ? newCityName : selectedCity?.name;

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Tarification à {cityName}</Text>

        {/* Frais de livraison */}
        <View style={styles.shippingSection}>
          <Text style={styles.shippingLabel}>Frais de livraison</Text>
          <View style={styles.shippingInput}>
            <TextInput
              style={styles.priceInput}
              value={shippingCost}
              onChangeText={setShippingCost}
              keyboardType="numeric"
              placeholder="2000"
            />
            <Text style={styles.currency}>FCFA</Text>
          </View>
        </View>

        {/* Prix par service */}
        {selectedServices.map((serviceKey) => {
          const service = serviceTypes.find((s) => s.key === serviceKey);
          if (!service) return null;

          return (
            <View key={serviceKey} style={styles.pricingSection}>
              <View style={styles.pricingSectionHeader}>
                <View style={[styles.serviceBadge, { backgroundColor: service.color }]}>
                  <Ionicons name={service.icon as any} size={16} color="#fff" />
                </View>
                <Text style={styles.pricingSectionTitle}>{service.label}</Text>
              </View>

              {documentTypes.map((doc) => (
                <View key={doc.key} style={styles.priceRow}>
                  <Text style={styles.docName} numberOfLines={1}>
                    {doc.label}
                  </Text>
                  <View style={styles.priceInputContainer}>
                    <TextInput
                      style={styles.priceInputSmall}
                      value={prices[serviceKey]?.[doc.key] || ''}
                      onChangeText={(value) =>
                        setPrices((prev) => ({
                          ...prev,
                          [serviceKey]: {
                            ...prev[serviceKey],
                            [doc.key]: value,
                          },
                        }))
                      }
                      keyboardType="numeric"
                      placeholder="0"
                    />
                    <Text style={styles.currencySmall}>FCFA</Text>
                  </View>
                </View>
              ))}
            </View>
          );
        })}
      </View>
    );
  };

  // Render étape 4: Délégué
  const renderDelegateStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Assigner un délégué</Text>
      <Text style={styles.stepDescription}>
        Recherchez un utilisateur existant pour le promouvoir délégué
      </Text>

      {/* Recherche */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par nom ou téléphone..."
          value={searchQuery}
          onChangeText={handleSearchUser}
        />
      </View>

      {/* Résultats de recherche */}
      {searchResults.length > 0 && !selectedUser && (
        <View style={styles.searchResults}>
          {searchResults.map((user) => (
            <TouchableOpacity
              key={user.id}
              style={styles.searchResultItem}
              onPress={() => handleSelectUser(user)}
            >
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>{user.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userPhone}>{user.phone}</Text>
              </View>
              {user.role === 'delegate' && (
                <View style={styles.delegateBadge}>
                  <Text style={styles.delegateBadgeText}>Délégué</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Utilisateur sélectionné */}
      {selectedUser && (
        <View style={styles.selectedUserCard}>
          <View style={styles.selectedUserHeader}>
            <View style={styles.userAvatarLarge}>
              <Text style={styles.userAvatarTextLarge}>
                {selectedUser.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.selectedUserInfo}>
              <Text style={styles.selectedUserName}>{selectedUser.name}</Text>
              <Text style={styles.selectedUserPhone}>{selectedUser.phone}</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setSelectedUser(null);
                setSearchQuery('');
              }}
            >
              <Ionicons name="close-circle" size={24} color="#ef4444" />
            </TouchableOpacity>
          </View>

          {/* Contact Mobile Money */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Contact Mobile Money *</Text>
            <TextInput
              style={styles.input}
              value={delegateMobileMoney}
              onChangeText={setDelegateMobileMoney}
              placeholder="Numéro pour recevoir les paiements"
              keyboardType="phone-pad"
            />
          </View>
        </View>
      )}
    </View>
  );

  // Render étape 5: Résumé
  const renderSummaryStep = () => {
    const cityName = isNewCity ? newCityName : selectedCity?.name;

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Récapitulatif</Text>

        <View style={styles.summaryCard}>
          {/* Ville */}
          <View style={styles.summaryRow}>
            <Ionicons name="location" size={20} color="#047857" />
            <View style={styles.summaryRowContent}>
              <Text style={styles.summaryLabel}>Ville</Text>
              <Text style={styles.summaryValue}>{cityName}</Text>
            </View>
          </View>

          {/* Services */}
          <View style={styles.summaryRow}>
            <Ionicons name="briefcase" size={20} color="#047857" />
            <View style={styles.summaryRowContent}>
              <Text style={styles.summaryLabel}>Services</Text>
              <Text style={styles.summaryValue}>
                {selectedServices
                  .map((s) => serviceTypes.find((st) => st.key === s)?.label)
                  .join(', ')}
              </Text>
            </View>
          </View>

          {/* Frais livraison */}
          <View style={styles.summaryRow}>
            <Ionicons name="car" size={20} color="#047857" />
            <View style={styles.summaryRowContent}>
              <Text style={styles.summaryLabel}>Frais de livraison</Text>
              <Text style={styles.summaryValue}>{shippingCost} FCFA</Text>
            </View>
          </View>

          {/* Délégué */}
          <View style={styles.summaryRow}>
            <Ionicons name="person" size={20} color="#047857" />
            <View style={styles.summaryRowContent}>
              <Text style={styles.summaryLabel}>Délégué</Text>
              <Text style={styles.summaryValue}>{selectedUser?.name}</Text>
              <Text style={styles.summarySubvalue}>{delegateMobileMoney}</Text>
            </View>
          </View>
        </View>

        {/* Tarifs */}
        <Text style={styles.summaryPricesTitle}>Tarifs configurés</Text>
        {selectedServices.map((serviceKey) => {
          const service = serviceTypes.find((s) => s.key === serviceKey);
          return (
            <View key={serviceKey} style={styles.summaryPriceSection}>
              <Text style={styles.summaryServiceName}>{service?.label}</Text>
              {documentTypes.slice(0, 3).map((doc) => (
                <View key={doc.key} style={styles.summaryPriceRow}>
                  <Text style={styles.summaryDocName}>{doc.label}</Text>
                  <Text style={styles.summaryPrice}>
                    {prices[serviceKey]?.[doc.key] || '0'} FCFA
                  </Text>
                </View>
              ))}
              {documentTypes.length > 3 && (
                <Text style={styles.summaryMore}>
                  +{documentTypes.length - 3} autres documents...
                </Text>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  // Render contenu de l'étape courante
  const renderStepContent = () => {
    switch (currentStep) {
      case 'city':
        return renderCityStep();
      case 'services':
        return renderServicesStep();
      case 'pricing':
        return renderPricingStep();
      case 'delegate':
        return renderDelegateStep();
      case 'summary':
        return renderSummaryStep();
      default:
        return null;
    }
  };

  if (loading) {
    return <Loading message="Chargement..." />;
  }

  const stepIndex = STEPS.findIndex((s) => s.key === currentStep);
  const isLastStep = stepIndex === STEPS.length - 1;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuration de ville</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress */}
      <View style={styles.progress}>
        {STEPS.map((step, index) => (
          <React.Fragment key={step.key}>
            <TouchableOpacity
              style={[
                styles.progressStep,
                index <= stepIndex && styles.progressStepActive,
              ]}
              onPress={() => index < stepIndex && setCurrentStep(step.key)}
              disabled={index > stepIndex}
            >
              <Ionicons
                name={step.icon as any}
                size={18}
                color={index <= stepIndex ? '#fff' : '#9ca3af'}
              />
            </TouchableOpacity>
            {index < STEPS.length - 1 && (
              <View
                style={[
                  styles.progressLine,
                  index < stepIndex && styles.progressLineActive,
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Contenu */}
      <ScrollView contentContainerStyle={styles.content}>{renderStepContent()}</ScrollView>

      {/* Footer navigation */}
      <View style={styles.footer}>
        {stepIndex > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={goToPreviousStep}>
            <Ionicons name="arrow-back" size={20} color="#047857" />
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.nextButton,
            !canProceed() && styles.nextButtonDisabled,
            stepIndex === 0 && styles.nextButtonFull,
          ]}
          onPress={isLastStep ? handleSave : goToNextStep}
          disabled={!canProceed() || saving}
        >
          {saving ? (
            <Text style={styles.nextButtonText}>Enregistrement...</Text>
          ) : (
            <>
              <Text style={styles.nextButtonText}>
                {isLastStep ? 'Enregistrer' : 'Suivant'}
              </Text>
              <Ionicons
                name={isLastStep ? 'checkmark' : 'arrow-forward'}
                size={20}
                color="#fff"
              />
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#047857',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  progressStep: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressStepActive: {
    backgroundColor: '#047857',
  },
  progressLine: {
    width: 30,
    height: 3,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 4,
  },
  progressLineActive: {
    backgroundColor: '#047857',
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  // Étape 1: Ville
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  optionCardSelected: {
    borderColor: '#047857',
    backgroundColor: '#f0fdf4',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  optionTextSelected: {
    color: '#047857',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginBottom: 16,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  separatorText: {
    marginHorizontal: 16,
    color: '#9ca3af',
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
  },
  cityList: {
    maxHeight: 250,
  },
  cityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cityCardSelected: {
    borderColor: '#047857',
    backgroundColor: '#f0fdf4',
  },
  cityInfo: {
    flex: 1,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  cityMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    paddingVertical: 20,
  },
  // Étape 2: Services
  servicesGrid: {
    gap: 12,
  },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    position: 'relative',
  },
  serviceCardSelected: {
    borderColor: '#047857',
    backgroundColor: '#f0fdf4',
  },
  serviceCardDisabled: {
    opacity: 0.6,
  },
  serviceIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  serviceNameSelected: {
    color: '#047857',
  },
  existingBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  existingBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#d97706',
  },
  checkIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  // Étape 3: Tarifs
  shippingSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  shippingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  shippingInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceInput: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  currency: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  pricingSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  pricingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  serviceBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pricingSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  docName: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    marginRight: 12,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceInputSmall: {
    width: 80,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  currencySmall: {
    fontSize: 12,
    color: '#9ca3af',
  },
  // Étape 4: Délégué
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
  },
  searchResults: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  userPhone: {
    fontSize: 13,
    color: '#6b7280',
  },
  delegateBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  delegateBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563eb',
  },
  selectedUserCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  selectedUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  userAvatarLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarTextLarge: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  selectedUserInfo: {
    flex: 1,
  },
  selectedUserName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  selectedUserPhone: {
    fontSize: 14,
    color: '#6b7280',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  // Étape 5: Résumé
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  summaryRowContent: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  summarySubvalue: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  summaryPricesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  summaryPriceSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  summaryServiceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#047857',
    marginBottom: 10,
  },
  summaryPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryDocName: {
    fontSize: 13,
    color: '#6b7280',
  },
  summaryPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  summaryMore: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 6,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#047857',
    gap: 6,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#047857',
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#047857',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
