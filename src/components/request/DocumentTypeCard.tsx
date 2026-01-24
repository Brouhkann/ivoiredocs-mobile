import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Text, Card as PaperCard } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import type { DocumentConfig } from '../../types';

interface DocumentTypeCardProps {
  document: DocumentConfig;
  onPress: () => void;
}

const iconMap: Record<string, string> = {
  declaration_naissance: 'document-text',
  extrait_acte_naissance: 'document',
  copie_integrale_naissance: 'documents',
  extrait_acte_mariage: 'heart',
  copie_integrale_mariage: 'heart-circle',
  certificat_celibat: 'person',
  certificat_non_divorce: 'people',
  certificat_residence: 'home',
};

export default function DocumentTypeCard({ document, onPress }: DocumentTypeCardProps) {
  const iconName = iconMap[document.type] || 'document';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.container}>
      <PaperCard mode="elevated" style={styles.card}>
        <View style={styles.goldAccent} />
        <PaperCard.Content style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name={iconName as any} size={22} color="#047857" />
          </View>
          <Text variant="titleSmall" style={styles.title} numberOfLines={2}>
            {document.name}
          </Text>
          {/* Indicateur cliquable */}
          <View style={styles.tapIndicator}>
            <Text style={styles.tapText}>Sélectionner</Text>
            <Ionicons name="chevron-forward" size={12} color="#047857" />
          </View>
        </PaperCard.Content>
      </PaperCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 5,
  },
  card: {
    borderRadius: 10,
    height: '100%',
    borderWidth: 1.5,
    borderColor: '#d1fae5',
    elevation: 4,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  goldAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#d4af37',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    zIndex: 1,
  },
  content: {
    alignItems: 'center',
    padding: 10,
    paddingTop: 14,
    paddingBottom: 8,
    height: '100%',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ecfdf5',
    borderWidth: 2,
    borderColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: '#047857',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  tapIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 2,
  },
  tapText: {
    fontSize: 10,
    color: '#047857',
    fontWeight: '600',
  },
});
