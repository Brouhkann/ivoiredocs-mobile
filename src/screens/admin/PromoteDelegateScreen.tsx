import React, { useState } from 'react';
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

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
}

const SERVICES = [
  { value: 'mairie', label: 'Mairie' },
  { value: 'sous_prefecture', label: 'Sous-Préfecture' },
  { value: 'justice', label: 'Justice' },
];

export default function PromoteDelegateScreen({ navigation }: any) {
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Form fields
  const [city, setCity] = useState('');
  const [service, setService] = useState('mairie');
  const [cni, setCni] = useState('');
  const [otherContact, setOtherContact] = useState('');
  const [mobileMoneyContact, setMobileMoneyContact] = useState('');
  const [address, setAddress] = useState('');

  const searchUserSuggestions = async (query: string) => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, phone, role')
        .neq('role', 'delegate')
        .or(`email.ilike.%${query}%,name.ilike.%${query}%`)
        .limit(5);

      if (error) throw error;

      setSuggestions(data || []);
      setShowSuggestions(true);
    } catch (error: any) {
      console.error('Erreur recherche suggestions:', error);
    }
  };

  const handleEmailChange = (text: string) => {
    setSearchEmail(text);
    searchUserSuggestions(text);
  };

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setSearchEmail(user.email);
    setShowSuggestions(false);
    setSuggestions([]);
    // Pre-fill mobile money contact with user's phone
    setMobileMoneyContact(user.phone || '');
  };

  const handleSearchUser = async () => {
    if (!searchEmail.trim()) {
      toast.error('Veuillez entrer un email');
      return;
    }

    try {
      setSearching(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, phone, role')
        .eq('email', searchEmail.trim())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          toast.error('Aucun utilisateur trouvé avec cet email');
        } else {
          throw error;
        }
        return;
      }

      if (data.role === 'delegate') {
        toast.error('Cet utilisateur est déjà un délégué');
        setSelectedUser(null);
        return;
      }

      setSelectedUser(data);
      setShowSuggestions(false);
    } catch (error: any) {
      console.error('Erreur recherche utilisateur:', error);
      toast.error('Erreur lors de la recherche');
    } finally {
      setSearching(false);
    }
  };

  const handlePromoteToDelegate = async () => {
    if (!selectedUser) {
      toast.error('Veuillez d\'abord rechercher un utilisateur');
      return;
    }

    if (!city.trim()) {
      toast.error('Veuillez entrer une ville');
      return;
    }

    try {
      setPromoting(true);

      // 1. Check if city exists, if not create it
      const { data: existingCity, error: cityCheckError } = await supabase
        .from('cities')
        .select('id, name')
        .ilike('name', city.trim())
        .single();

      if (cityCheckError && cityCheckError.code !== 'PGRST116') {
        throw cityCheckError;
      }

      if (!existingCity) {
        // Create new city
        const { error: cityCreateError } = await supabase
          .from('cities')
          .insert({
            name: city.trim(),
            is_active: true,
          });

        if (cityCreateError) throw cityCreateError;
        toast.success(`Ville "${city.trim()}" ajoutée à la base de données`);
      }

      // 2. Check if delegate already exists for this city and service
      const { data: existingDelegate, error: delegateCheckError } = await supabase
        .from('delegates')
        .select('id, name')
        .eq('city', city.trim())
        .eq('service_type', service)
        .eq('is_available', true)
        .single();

      if (delegateCheckError && delegateCheckError.code !== 'PGRST116') {
        throw delegateCheckError;
      }

      if (existingDelegate) {
        toast.error(`Un délégué actif (${existingDelegate.name}) existe déjà pour le service ${SERVICES.find(s => s.value === service)?.label} à ${city.trim()}`);
        return;
      }

      // 3. Create delegate record
      const { error: delegateError } = await supabase
        .from('delegates')
        .insert({
          user_id: selectedUser.id,
          name: selectedUser.name,
          email: selectedUser.email,
          phone: selectedUser.phone,
          city: city.trim(),
          service_admin: service,
          service_type: service,
          cni: cni.trim() || null,
          other_contact: otherContact.trim() || null,
          mobile_money_contact: mobileMoneyContact.trim() || selectedUser.phone,
          address: address.trim() || null,
          is_active: true,
          is_available: true,
          rating: 4.0,
          total_requests: 0,
          total_earnings: 0,
          documents_verified: false,
        });

      if (delegateError) throw delegateError;

      // 4. Update user role to delegate
      const { error: roleError } = await supabase
        .from('users')
        .update({ role: 'delegate' })
        .eq('id', selectedUser.id);

      if (roleError) throw roleError;

      toast.success(`${selectedUser.name} a été promu délégué avec succès!`);

      // Reset form
      setSelectedUser(null);
      setSearchEmail('');
      setCity('');
      setService('mairie');
      setCni('');
      setOtherContact('');
      setMobileMoneyContact('');
      setAddress('');

      // Navigate back to delegates management
      navigation.goBack();
    } catch (error: any) {
      console.error('Erreur promotion délégué:', error);
      toast.error('Erreur lors de la promotion en délégué');
    } finally {
      setPromoting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Promouvoir en délégué"
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Search Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rechercher un utilisateur</Text>
          <View style={styles.searchWrapper}>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Email ou nom de l'utilisateur..."
                value={searchEmail}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#9ca3af"
              />
              {searchEmail.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => {
                    setSearchEmail('');
                    setSuggestions([]);
                    setShowSuggestions(false);
                    setSelectedUser(null);
                  }}
                >
                  <Ionicons name="close-circle" size={20} color="#6b7280" />
                </TouchableOpacity>
              )}
            </View>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {suggestions.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    style={styles.suggestionItem}
                    onPress={() => handleSelectUser(user)}
                  >
                    <View style={styles.suggestionAvatar}>
                      <Ionicons name="person" size={20} color="#047857" />
                    </View>
                    <View style={styles.suggestionInfo}>
                      <Text style={styles.suggestionName}>{user.name}</Text>
                      <Text style={styles.suggestionEmail}>{user.email}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {showSuggestions && suggestions.length === 0 && searchEmail.length >= 2 && (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>Aucun utilisateur trouvé</Text>
              </View>
            )}
          </View>
        </View>

        {/* Selected User Card */}
        {selectedUser && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Utilisateur sélectionné</Text>
            <View style={styles.userCard}>
              <View style={styles.userAvatar}>
                <Ionicons name="person" size={32} color="#047857" />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{selectedUser.name}</Text>
                <Text style={styles.userEmail}>{selectedUser.email}</Text>
                <Text style={styles.userPhone}>{selectedUser.phone}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Promotion Form */}
        {selectedUser && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informations du délégué</Text>

            {/* City */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Ville *</Text>
              <TextInput
                style={styles.input}
                placeholder="Entrez la ville"
                value={city}
                onChangeText={setCity}
                placeholderTextColor="#9ca3af"
              />
              <Text style={styles.hint}>
                La ville sera ajoutée automatiquement si elle n'existe pas
              </Text>
            </View>

            {/* Service */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Service *</Text>
              <View style={styles.serviceButtons}>
                {SERVICES.map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    style={[
                      styles.serviceButton,
                      service === s.value && styles.serviceButtonActive,
                    ]}
                    onPress={() => setService(s.value)}
                  >
                    <Text
                      style={[
                        styles.serviceButtonText,
                        service === s.value && styles.serviceButtonTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* CNI */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Numéro de CNI</Text>
              <TextInput
                style={styles.input}
                placeholder="Numéro de carte d'identité (optionnel)"
                value={cni}
                onChangeText={setCni}
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Address */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Adresse</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Adresse complète (optionnel)"
                value={address}
                onChangeText={setAddress}
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Other Contact */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Autre contact</Text>
              <TextInput
                style={styles.input}
                placeholder="Numéro de téléphone secondaire (optionnel)"
                value={otherContact}
                onChangeText={setOtherContact}
                keyboardType="phone-pad"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Mobile Money Contact */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Contact Mobile Money *</Text>
              <TextInput
                style={styles.input}
                placeholder="Numéro Mobile Money"
                value={mobileMoneyContact}
                onChangeText={setMobileMoneyContact}
                keyboardType="phone-pad"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Info Note */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color="#0369a1" />
              <Text style={styles.infoText}>
                Les documents (photo CNI, contrat) pourront être ajoutés ultérieurement via l'interface web.
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handlePromoteToDelegate}
              disabled={promoting}
            >
              {promoting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={20} color="#ffffff" />
                  <Text style={styles.submitButtonText}>Promouvoir en délégué</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  searchWrapper: {
    position: 'relative',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  clearButton: {
    marginLeft: 8,
  },
  suggestionsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  suggestionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  suggestionEmail: {
    fontSize: 12,
    color: '#6b7280',
  },
  noResultsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginTop: 8,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  userCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  userAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 13,
    color: '#6b7280',
  },
  formGroup: {
    marginBottom: 20,
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  serviceButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  serviceButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  serviceButtonActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  serviceButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  serviceButtonTextActive: {
    color: '#ffffff',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#0369a1',
    lineHeight: 18,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#047857',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
