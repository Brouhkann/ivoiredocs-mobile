import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking, Image } from 'react-native';
import { Text, Button as PaperButton } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

export default function WelcomeScreen({ navigation }: any) {
  const handleWhatsApp = () => {
    const message = encodeURIComponent('Bonjour, je souhaite en savoir plus sur Ivoiredocs.');
    Linking.openURL(`https://wa.me/2250545703076?text=${message}`);
  };

  const handleNavigateToAuth = () => {
    navigation.navigate('Auth');
  };

  const documents = [
    {
      name: 'Déclaration de naissance',
      location: 'Mairie / Sous-préfecture',
      delay: '48-72h ouvrés',
    },
    {
      name: 'Extrait acte de naissance',
      location: 'Mairie / Sous-préfecture',
      delay: '48-72h ouvrés',
    },
    {
      name: 'Copie intégrale acte de naissance',
      location: 'Mairie / Sous-préfecture',
      delay: '48-72h ouvrés',
    },
    {
      name: 'Certificat de célibat',
      location: 'Mairie / Sous-préfecture',
      delay: '48-72h ouvrés',
    },
    {
      name: 'Certificat de résidence',
      location: 'Mairie',
      delay: '48-72h ouvrés',
    },
  ];

  const cities = [
    'Abidjan', 'Bouaké', 'Daloa', 'Yamoussoukro',
    'San-Pedro', 'Korhogo', 'Man', 'Divo',
  ];

  const features = [
    {
      icon: 'flash',
      title: 'Rapide et efficace',
      description: 'Obtenez vos documents en 48-72h ouvrés',
    },
    {
      icon: 'shield-checkmark',
      title: 'Sécurisé',
      description: 'Vos informations sont protégées et cryptées',
    },
    {
      icon: 'people',
      title: 'Délégués certifiés',
      description: 'Des professionnels vérifiés à votre service',
    },
    {
      icon: 'checkmark-done',
      title: 'Service vérifié',
      description: 'Système de suivi en temps réel',
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.logo}>Ivoiredocs</Text>
          </View>

          <Text style={styles.heroTitle}>
            Vos documents administratifs sans déplacement
          </Text>

          <Text style={styles.heroSubtitle}>
            Obtenez vos extraits d'actes, votre déclaration de naissance et bien d'autres documents sans vous déplacer, partout en Côte d'Ivoire
          </Text>

          <PaperButton
            mode="contained"
            onPress={handleNavigateToAuth}
            style={styles.ctaButton}
            contentStyle={styles.ctaButtonContent}
            buttonColor="#ffffff"
            textColor="#047857"
            labelStyle={styles.ctaButtonLabel}
          >
            Se connecter
          </PaperButton>
        </View>

        {/* Pourquoi choisir Ivoiredocs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pourquoi choisir Ivoiredocs ?</Text>
          <Text style={styles.sectionSubtitle}>
            Un service complet pour simplifier vos démarches administratives
          </Text>

          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name={feature.icon as any} size={28} color="#047857" />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Documents disponibles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documents disponibles</Text>
          <Text style={styles.sectionSubtitle}>
            Large gamme de documents disponibles au meilleur prix
          </Text>

          <View style={styles.documentsList}>
            {documents.map((doc, index) => (
              <View key={index} style={styles.documentCard}>
                <View style={styles.documentIconContainer}>
                  <Ionicons name="document-text" size={24} color="#047857" />
                </View>
                <View style={styles.documentInfo}>
                  <Text style={styles.documentName}>{doc.name}</Text>
                  <Text style={styles.documentLocation}>{doc.location}</Text>
                  <View style={styles.documentMeta}>
                    <View style={styles.documentMetaItem}>
                      <Ionicons name="time" size={14} color="#6b7280" />
                      <Text style={styles.documentMetaText}>{doc.delay}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <PaperButton
            mode="contained"
            onPress={handleNavigateToAuth}
            style={styles.startButton}
            contentStyle={styles.startButtonContent}
            buttonColor="#047857"
          >
            Commencer maintenant
          </PaperButton>
        </View>

        {/* Disponible partout */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disponible dans toute la Côte d'Ivoire</Text>
          <Text style={styles.sectionSubtitle}>
            Notre réseau couvre les principales villes et nous étendons constamment
          </Text>

          <View style={styles.citiesGrid}>
            {cities.map((city, index) => (
              <View key={index} style={styles.cityChip}>
                <Ionicons name="location" size={14} color="#047857" />
                <Text style={styles.cityText}>{city}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Besoin d'aide */}
        <View style={styles.helpSection}>
          <View style={styles.whatsappIcon}>
            <Ionicons name="logo-whatsapp" size={40} color="#25D366" />
          </View>
          <Text style={styles.helpTitle}>Besoin d'aide ?</Text>
          <Text style={styles.helpSubtitle}>
            Notre équipe est disponible pour répondre à vos questions
          </Text>
          <TouchableOpacity style={styles.whatsappButton} onPress={handleWhatsApp}>
            <Ionicons name="logo-whatsapp" size={20} color="#ffffff" />
            <Text style={styles.whatsappButtonText}>+225 05 45 70 30 76</Text>
          </TouchableOpacity>
        </View>

        {/* CTA Final */}
        <View style={styles.finalCTA}>
          <Text style={styles.finalCTATitle}>
            Prêt à simplifier vos démarches administratives ?
          </Text>
          <Text style={styles.finalCTASubtitle}>
            Rejoignez des milliers d'Ivoiriens qui font confiance à Ivoiredocs
          </Text>
          <PaperButton
            mode="contained"
            onPress={handleNavigateToAuth}
            style={styles.finalCTAButton}
            contentStyle={styles.finalCTAButtonContent}
            buttonColor="#047857"
          >
            Créer mon compte gratuitement
          </PaperButton>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLogo}>Ivoiredocs</Text>
          <Text style={styles.footerText}>
            La plateforme digitale des Ivoiriens pour simplifier leurs démarches administratives
          </Text>
          <Text style={styles.footerCopyright}>
            © 2025 Ivoiredocs. Tous droits réservés.
          </Text>
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
  scrollContent: {
    paddingBottom: 40,
  },
  heroSection: {
    backgroundColor: '#047857',
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 30,
    alignItems: 'center',
    gap: 12,
  },
  logoImage: {
    width: 120,
    height: 120,
    tintColor: '#ffffff',
  },
  logo: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 36,
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  ctaButton: {
    borderRadius: 12,
    elevation: 4,
  },
  ctaButtonContent: {
    paddingVertical: 6,
    paddingHorizontal: 24,
  },
  ctaButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  featuresGrid: {
    gap: 20,
  },
  featureCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  featureIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  documentsList: {
    gap: 16,
  },
  documentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  documentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  documentLocation: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
  },
  documentMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  documentMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  documentMetaText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  startButton: {
    marginTop: 32,
    borderRadius: 12,
    elevation: 4,
  },
  startButtonContent: {
    paddingVertical: 8,
  },
  citiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  cityText: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '600',
  },
  helpSection: {
    backgroundColor: '#ecfdf5',
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginHorizontal: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#bbf7d0',
  },
  whatsappIcon: {
    marginBottom: 16,
  },
  helpTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 8,
  },
  helpSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
    elevation: 4,
  },
  whatsappButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  finalCTA: {
    backgroundColor: '#047857',
    paddingVertical: 50,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 20,
  },
  finalCTATitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 32,
  },
  finalCTASubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  finalCTAButton: {
    borderRadius: 12,
    elevation: 4,
    backgroundColor: '#ffffff',
  },
  finalCTAButtonContent: {
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  footer: {
    backgroundColor: '#111827',
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  footerLogo: {
    color: '#d4af37',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 16,
  },
  footerText: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  footerCopyright: {
    color: '#6b7280',
    fontSize: 12,
  },
});
