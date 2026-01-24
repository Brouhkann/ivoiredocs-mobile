import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { toast } from '../../stores/toastStore';
import AppHeader from '../../components/AppHeader';

interface DocumentType {
  key: string;
  label: string;
}

interface ServiceType {
  key: string;
  label: string;
  icon: string;
  color: string;
}

interface CityData {
  id: string;
  name: string;
  shipping_cost: number;
  processing_delay_multiplier: number;
  document_prices: Record<string, Record<string, number>>;
}

export default function CityPricingScreen({ route, navigation }: any) {
  const { cityId, cityName } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [pricesByService, setPricesByService] = useState<Record<string, Record<string, string>>>({});
  const [shippingCost, setShippingCost] = useState('1000');
  const [delayMultiplier, setDelayMultiplier] = useState('1.0');

  useEffect(() => {
    loadData();
  }, [cityId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load document types, service types, and city data in parallel
      const [docsResult, servicesResult, cityResult] = await Promise.all([
        supabase.from('document_types').select('key, label').eq('is_active', true).order('display_order'),
        supabase.from('service_types').select('key, label, icon, color').eq('is_active', true).order('display_order'),
        supabase.from('cities').select('*').eq('id', cityId).single(),
      ]);

      if (docsResult.error) throw docsResult.error;
      if (servicesResult.error) throw servicesResult.error;
      if (cityResult.error) throw cityResult.error;

      const docs = docsResult.data || [];
      const services = servicesResult.data || [];
      const cityData = cityResult.data;

      setDocumentTypes(docs);
      setServiceTypes(services);
      setCityData(cityData);
      setShippingCost(cityData.shipping_cost?.toString() || '1000');
      setDelayMultiplier(cityData.processing_delay_multiplier?.toString() || '1.0');

      // Set first service as selected
      if (services.length > 0 && !selectedService) {
        setSelectedService(services[0].key);
      }

      // Initialize prices by service
      const initialPricesByService: Record<string, Record<string, string>> = {};
      services.forEach(service => {
        initialPricesByService[service.key] = {};
        docs.forEach(doc => {
          const price = cityData.document_prices?.[service.key]?.[doc.key];
          initialPricesByService[service.key][doc.key] = price?.toString() || '';
        });
      });
      setPricesByService(initialPricesByService);
    } catch (error: any) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (docType: string, value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    setPricesByService(prev => ({
      ...prev,
      [selectedService]: {
        ...prev[selectedService],
        [docType]: numericValue,
      },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Convert prices to numbers grouped by service
      const documentPrices: Record<string, Record<string, number>> = {};

      Object.entries(pricesByService).forEach(([serviceKey, servicePrices]) => {
        documentPrices[serviceKey] = {};
        Object.entries(servicePrices).forEach(([docKey, price]) => {
          if (price && price.trim() !== '') {
            documentPrices[serviceKey][docKey] = parseInt(price, 10);
          }
        });
      });

      const shippingCostNum = parseInt(shippingCost, 10) || 1000;
      const delayMultiplierNum = parseFloat(delayMultiplier) || 1.0;

      const { error } = await supabase
        .from('cities')
        .update({
          document_prices: documentPrices,
          shipping_cost: shippingCostNum,
          processing_delay_multiplier: delayMultiplierNum,
        })
        .eq('id', cityId);

      if (error) throw error;

      toast.success('Prix enregistrés avec succès!');
      navigation.goBack();
    } catch (error: any) {
      console.error('Erreur sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyToAll = (docType: string) => {
    const price = pricesByService[selectedService]?.[docType];
    if (!price || price.trim() === '') {
      toast.error('Veuillez d\'abord entrer un prix');
      return;
    }

    const newPrices: Record<string, string> = {};
    documentTypes.forEach(doc => {
      newPrices[doc.key] = price;
    });

    setPricesByService(prev => ({
      ...prev,
      [selectedService]: newPrices,
    }));
    toast.success('Prix appliqué à tous les documents du service');
  };

  const handleCopyFromService = (sourceService: string) => {
    const sourcePrices = pricesByService[sourceService];
    if (!sourcePrices || Object.keys(sourcePrices).length === 0) {
      toast.error(`Aucun prix défini pour ${serviceTypes.find(s => s.key === sourceService)?.label}`);
      return;
    }

    setPricesByService(prev => ({
      ...prev,
      [selectedService]: { ...sourcePrices },
    }));
    toast.success(`Prix copiés depuis ${serviceTypes.find(s => s.key === sourceService)?.label}`);
  };

  const getPriceStats = () => {
    const currentPrices = pricesByService[selectedService] || {};
    const definedPrices = Object.values(currentPrices).filter(p => p && p.trim() !== '');
    const total = documentTypes.length;
    const defined = definedPrices.length;
    const percentage = total > 0 ? Math.round((defined / total) * 100) : 0;

    return { total, defined, percentage };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#047857" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  const stats = getPriceStats();

  return (
    <View style={styles.container}>
      <AppHeader
        title={`Prix - ${cityName}`}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Service Tabs */}
        <View style={styles.serviceTabs}>
          {serviceTypes.map((service) => {
            const servicePrices = pricesByService[service.key] || {};
            const definedCount = Object.values(servicePrices).filter(p => p && p.trim() !== '').length;
            const isSelected = selectedService === service.key;

            return (
              <TouchableOpacity
                key={service.key}
                style={[
                  styles.serviceTab,
                  isSelected && { backgroundColor: service.color },
                ]}
                onPress={() => setSelectedService(service.key)}
              >
                <View style={styles.serviceTabContent}>
                  <Ionicons
                    name={service.icon as any}
                    size={20}
                    color={isSelected ? '#ffffff' : service.color}
                  />
                  <Text
                    style={[
                      styles.serviceTabLabel,
                      isSelected && styles.serviceTabLabelActive,
                    ]}
                  >
                    {service.label}
                  </Text>
                  {definedCount > 0 && (
                    <View style={[styles.serviceBadge, !isSelected && { backgroundColor: service.color }]}>
                      <Text style={[styles.serviceBadgeText, !isSelected && { color: '#ffffff' }]}>
                        {definedCount}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Progress Card */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Ionicons name="analytics" size={24} color={serviceTypes.find(s => s.key === selectedService)?.color || '#2563eb'} />
            <Text style={styles.progressTitle}>
              Complétion - {serviceTypes.find(s => s.key === selectedService)?.label}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[
              styles.progressFill,
              {
                width: `${stats.percentage}%`,
                backgroundColor: serviceTypes.find(s => s.key === selectedService)?.color || '#047857',
              }
            ]} />
          </View>
          <Text style={styles.progressText}>
            {stats.defined} / {stats.total} documents ({stats.percentage}%)
          </Text>
        </View>

        {/* Copy from Service */}
        {serviceTypes.filter(s => s.key !== selectedService).length > 0 && (
          <View style={styles.copySection}>
            <Text style={styles.copySectionTitle}>Copier depuis un autre service</Text>
            <View style={styles.copyButtons}>
              {serviceTypes.filter(s => s.key !== selectedService).map((service) => {
                const servicePrices = pricesByService[service.key] || {};
                const count = Object.values(servicePrices).filter(p => p && p.trim() !== '').length;

                return (
                  <TouchableOpacity
                    key={service.key}
                    style={[styles.copyButton, { borderColor: service.color }]}
                    onPress={() => handleCopyFromService(service.key)}
                    disabled={count === 0}
                  >
                    <Ionicons name="copy" size={16} color={count > 0 ? service.color : '#9ca3af'} />
                    <Text style={[styles.copyButtonText, count === 0 && styles.copyButtonTextDisabled]}>
                      {service.label} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* General Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paramètres généraux</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Frais de livraison (FCFA)</Text>
            <TextInput
              style={styles.input}
              placeholder="1000"
              value={shippingCost}
              onChangeText={(text) => setShippingCost(text.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Multiplicateur de délai</Text>
            <TextInput
              style={styles.input}
              placeholder="1.0"
              value={delayMultiplier}
              onChangeText={(text) => {
                // Allow numbers and one decimal point
                const value = text.replace(/[^0-9.]/g, '');
                const parts = value.split('.');
                if (parts.length <= 2) {
                  setDelayMultiplier(value);
                }
              }}
              keyboardType="decimal-pad"
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.hint}>
              Ex: 1.5 = délai augmenté de 50%, 0.8 = réduit de 20%
            </Text>
          </View>
        </View>

        {/* Document Prices */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Prix par document</Text>
            <Text style={styles.sectionSubtitle}>Prix en FCFA</Text>
          </View>

          {documentTypes.map((doc, index) => {
            const currentServicePrices = pricesByService[selectedService] || {};
            const hasPrice = currentServicePrices[doc.key] && currentServicePrices[doc.key].trim() !== '';
            const serviceColor = serviceTypes.find(s => s.key === selectedService)?.color || '#047857';

            return (
              <View key={doc.key} style={styles.documentRow}>
                <View style={styles.documentHeader}>
                  <View style={styles.documentIcon}>
                    <Ionicons
                      name={hasPrice ? "checkmark-circle" : "radio-button-off"}
                      size={20}
                      color={hasPrice ? serviceColor : "#9ca3af"}
                    />
                  </View>
                  <Text style={styles.documentLabel}>{doc.label}</Text>
                </View>

                <View style={styles.priceInputRow}>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="0"
                    value={currentServicePrices[doc.key] || ''}
                    onChangeText={(value) => handlePriceChange(doc.key, value)}
                    keyboardType="numeric"
                    placeholderTextColor="#9ca3af"
                  />
                  <Text style={styles.currencyText}>FCFA</Text>

                  {index === 0 && currentServicePrices[doc.key] && currentServicePrices[doc.key].trim() !== '' && (
                    <TouchableOpacity
                      style={[styles.applyAllButton, { backgroundColor: `${serviceColor}20` }]}
                      onPress={() => handleApplyToAll(doc.key)}
                    >
                      <Ionicons name="copy" size={16} color={serviceColor} />
                      <Text style={[styles.applyAllText, { color: serviceColor }]}>Appliquer à tous</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Save Button */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="save" size={20} color="#ffffff" />
                <Text style={styles.saveButtonText}>Enregistrer les prix</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  serviceTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 8,
  },
  serviceTab: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  serviceTabContent: {
    alignItems: 'center',
    gap: 6,
  },
  serviceTabLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textAlign: 'center',
  },
  serviceTabLabelActive: {
    color: '#ffffff',
  },
  serviceBadge: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  serviceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#111827',
  },
  copySection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  copySectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 8,
  },
  copyButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  copyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 6,
  },
  copyButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  copyButtonTextDisabled: {
    color: '#9ca3af',
  },
  progressCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#047857',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  documentRow: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  documentIcon: {
    marginRight: 8,
  },
  documentLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceInput: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  currencyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  applyAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  applyAllText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionContainer: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#047857',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
