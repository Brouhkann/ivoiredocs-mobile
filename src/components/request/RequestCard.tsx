import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Card as PaperCard } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import Badge from '../ui/Badge';
import type { Request } from '../../types';
import { DOCUMENT_CONFIGS } from '../../utils/documents';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RequestCardProps {
  request: Request;
  onPress: () => void;
}

export default function RequestCard({ request, onPress }: RequestCardProps) {
  const documentConfig = DOCUMENT_CONFIGS[request.document_type];
  const formattedDate = format(new Date(request.created_at), 'd MMM', { locale: fr });

  // Fonction pour extraire le nom de la personne concernée selon le type de document
  const getPersonName = (): string => {
    if (!request.form_data) return '';

    // Pour déclaration de naissance : nom de l'enfant
    if (request.document_type === 'declaration_naissance') {
      const nom = request.form_data.nom_enfant || '';
      const prenoms = request.form_data.prenoms_enfant || '';
      return nom && prenoms ? `${nom} ${prenoms}` : nom || prenoms;
    }

    // Pour extrait de naissance, copie intégrale, certificats : nom_complet
    if (['extrait_acte_naissance', 'copie_integrale_naissance',
         'certificat_celibat', 'certificat_non_divorce', 'certificat_residence'].includes(request.document_type)) {
      return request.form_data.nom_complet || '';
    }

    // Pour extrait/copie de mariage : nom des époux
    if (['extrait_acte_mariage', 'copie_integrale_mariage'].includes(request.document_type)) {
      const epoux = request.form_data.nom_epoux || '';
      const epouse = request.form_data.nom_epouse || '';
      return epoux && epouse ? `${epoux} & ${epouse}` : epoux || epouse;
    }

    // Fallback : nom de livraison
    return request.form_data.full_name || '';
  };

  const personName = getPersonName();
  const isForMarriage = request.document_type === 'extrait_acte_naissance' &&
                        request.form_data?.en_vue_mariage === 'true';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardWrapper,
        pressed && styles.cardPressed
      ]}
    >
      <View style={styles.cardInner}>
        {/* Bordure dorée à gauche */}
        <View style={styles.goldBorder} />

        <PaperCard style={styles.card} mode="elevated" elevation={3}>
          <View style={styles.cardContent}>
            {/* Header avec fond légèrement coloré */}
            <View style={styles.header}>
              <Badge status={request.status} label="" />
              <View style={styles.dateContainer}>
                <Ionicons name="calendar-outline" size={12} color="#d4af37" />
                <Text style={styles.date}>{formattedDate}</Text>
              </View>
            </View>

            {/* Titre avec icône */}
            <View style={styles.titleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="document-text" size={16} color="#d4af37" />
              </View>
              <Text style={styles.title} numberOfLines={2}>
                {documentConfig.name}
              </Text>
            </View>

            {/* Nom de la personne avec style */}
            {personName && (
              <View style={styles.personNameContainer}>
                <Ionicons name="person" size={13} color="#d4af37" />
                <Text style={styles.personName} numberOfLines={1}>
                  {personName}
                </Text>
              </View>
            )}

            {/* Indicateur mariage */}
            {isForMarriage && (
              <View style={styles.marriageIndicator}>
                <Text style={styles.marriageText}>💍 En vue de mariage</Text>
              </View>
            )}

            {/* Informations avec icônes dorées */}
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="location" size={11} color="#d4af37" />
                <Text style={styles.infoText}>{request.city}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="business" size={11} color="#d4af37" />
                <Text style={styles.infoText}>
                  {request.service_type === 'mairie' ? 'Mairie' : 'S/Préf'}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="copy" size={11} color="#d4af37" />
                <Text style={styles.infoText}>{request.copies}x</Text>
              </View>
            </View>

            {/* Prix avec style amélioré */}
            <View style={styles.priceRow}>
              <View style={styles.priceContainer}>
                <Text style={styles.priceLabel}>Total</Text>
                <View style={styles.priceValueRow}>
                  <Text style={styles.priceAmount}>
                    {request.total_amount.toLocaleString()}
                  </Text>
                  <Text style={styles.priceCurrency}>FCFA</Text>
                </View>
              </View>
              <View style={styles.arrowButton}>
                <Ionicons name="arrow-forward" size={16} color="#ffffff" />
              </View>
            </View>
          </View>
        </PaperCard>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  cardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  cardInner: {
    position: 'relative',
  },
  goldBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#d4af37',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    zIndex: 1,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardContent: {
    padding: 14,
  },

  // Header avec fond léger
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#faf8f5',
    marginHorizontal: -14,
    marginTop: -14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  date: {
    color: '#d4af37',
    fontSize: 11,
    fontWeight: '600',
  },

  // Titre avec icône
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#faf8f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#d4af37',
  },
  title: {
    flex: 1,
    color: '#047857',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    paddingTop: 4,
  },

  // Nom de la personne - élégant
  personNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#faf8f5',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#d4af37',
  },
  personName: {
    flex: 1,
    color: '#047857',
    fontSize: 13,
    fontWeight: '600',
  },

  // Indicateur mariage
  marriageIndicator: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  marriageText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '600',
  },

  // Informations avec icônes dorées
  infoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  infoText: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '600',
  },

  // Prix élégant
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    color: '#6b7280',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  priceValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  priceAmount: {
    color: '#047857',
    fontSize: 18,
    fontWeight: '800',
  },
  priceCurrency: {
    color: '#d4af37',
    fontSize: 12,
    fontWeight: '700',
  },
  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
});
