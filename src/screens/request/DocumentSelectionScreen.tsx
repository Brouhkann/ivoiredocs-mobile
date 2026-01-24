import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import DocumentTypeCard from '../../components/request/DocumentTypeCard';
import { DOCUMENT_CONFIGS } from '../../utils/documents';
import type { DocumentType } from '../../types';

export default function DocumentSelectionScreen({ navigation }: any) {
  const handleDocumentSelect = (documentType: DocumentType) => {
    navigation.navigate('RequestForm', { documentType });
  };

  // Organisation par catégories
  const naissanceDocuments = [
    DOCUMENT_CONFIGS.declaration_naissance,
    DOCUMENT_CONFIGS.extrait_acte_naissance,
    DOCUMENT_CONFIGS.copie_integrale_naissance,
  ];

  const mariageDocuments = [
    DOCUMENT_CONFIGS.extrait_acte_mariage,
    DOCUMENT_CONFIGS.copie_integrale_mariage,
  ];

  const certificatDocuments = [
    DOCUMENT_CONFIGS.certificat_celibat,
    DOCUMENT_CONFIGS.certificat_non_divorce,
    DOCUMENT_CONFIGS.certificat_residence,
  ];

  return (
    <View style={styles.container}>
      {/* Header personnalisé vert emerald */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouvelle demande</Text>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoContent}>
          <Ionicons name="hand-left" size={14} color="#ffffff" />
          <Text style={styles.infoText}>
            Sélectionnez le document souhaité
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Catégorie: Actes de naissance */}
        <View style={styles.categorySection}>
          <View style={styles.categoryHeader}>
            <Ionicons name="person-add" size={16} color="#047857" />
            <Text style={styles.categoryTitle}>Actes de naissance</Text>
          </View>
          <View style={styles.categoryGrid}>
            {naissanceDocuments.map((doc) => (
              <View key={doc.type} style={styles.cardWrapper}>
                <DocumentTypeCard
                  document={doc}
                  onPress={() => handleDocumentSelect(doc.type)}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Catégorie: Actes de mariage */}
        <View style={styles.categorySection}>
          <View style={styles.categoryHeader}>
            <Ionicons name="heart" size={16} color="#047857" />
            <Text style={styles.categoryTitle}>Actes de mariage</Text>
          </View>
          <View style={styles.categoryGrid}>
            {mariageDocuments.map((doc) => (
              <View key={doc.type} style={styles.cardWrapper}>
                <DocumentTypeCard
                  document={doc}
                  onPress={() => handleDocumentSelect(doc.type)}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Catégorie: Certificats */}
        <View style={styles.categorySection}>
          <View style={styles.categoryHeader}>
            <Ionicons name="document" size={16} color="#047857" />
            <Text style={styles.categoryTitle}>Certificats</Text>
          </View>
          <View style={styles.categoryGrid}>
            {certificatDocuments.map((doc) => (
              <View key={doc.type} style={styles.cardWrapper}>
                <DocumentTypeCard
                  document={doc}
                  onPress={() => handleDocumentSelect(doc.type)}
                />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
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
    elevation: 4,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 16,
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#d4af37',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  infoContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    color: '#ffffff',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  categorySection: {
    marginTop: 10,
    paddingHorizontal: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 4,
  },
  categoryTitle: {
    color: '#047857',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 6,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  cardWrapper: {
    width: '50%',
    paddingHorizontal: 0,
  },
});
