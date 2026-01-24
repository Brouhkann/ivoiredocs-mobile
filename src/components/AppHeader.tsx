import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text } from 'react-native-paper';

interface AppHeaderProps {
  userName?: string;
  showLogo?: boolean;
}

export default function AppHeader({
  userName,
  showLogo = true,
}: AppHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        {/* Logo et nom de l'application */}
        {showLogo && (
          <View style={styles.logoSection}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Ivoiredocs</Text>
          </View>
        )}

        {/* Nom utilisateur à droite */}
        {userName && (
          <View style={styles.userSection}>
            <Text style={styles.greeting}>Bonjour,</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#047857',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 8,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 6,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 56,
    height: 56,
    tintColor: '#ffffff',
  },
  appName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  userSection: {
    alignItems: 'flex-end',
  },
  greeting: {
    color: '#d4af37',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  userName: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.3,
  },
});
