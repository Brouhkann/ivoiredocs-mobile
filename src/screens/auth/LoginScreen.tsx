import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Linking } from 'react-native';
import { Text, TextInput, Button, Card } from 'react-native-paper';
import { useAuthStore, AuthError, AUTH_ERROR_CODES } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { isValidIvorianPhone, getWhatsAppSupportLink } from '../../utils/phoneValidation';

export default function LoginScreen({ navigation }: any) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const signIn = useAuthStore((state) => state.signIn);

  const clearErrors = () => {
    setPhoneError('');
    setPasswordError('');
  };

  const handleLogin = async () => {
    clearErrors();

    // Validation du téléphone
    if (!phone) {
      setPhoneError('Veuillez entrer votre numéro de téléphone');
      return;
    }

    if (!isValidIvorianPhone(phone)) {
      setPhoneError('Numéro de téléphone invalide. Format: +225 XX XX XX XX XX');
      return;
    }

    // Validation du mot de passe
    if (!password) {
      setPasswordError('Veuillez entrer votre mot de passe');
      return;
    }

    setLoading(true);
    try {
      await signIn(phone, password);
      toast.success('Connexion réussie !');
    } catch (error: any) {
      console.error('Erreur de connexion:', error);

      if (error instanceof AuthError) {
        switch (error.code) {
          case AUTH_ERROR_CODES.PHONE_NOT_REGISTERED:
            setPhoneError("Ce numéro n'est pas encore enregistré");
            toast.error("Numéro non enregistré. Veuillez créer un compte.");
            break;
          case AUTH_ERROR_CODES.WRONG_PASSWORD:
            setPasswordError('Mot de passe incorrect');
            toast.error('Mot de passe incorrect');
            break;
          default:
            toast.error(error.message || 'Erreur de connexion');
        }
      } else {
        toast.error('Erreur de connexion. Veuillez réessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    const whatsappLink = getWhatsAppSupportLink(phone || undefined);
    Linking.openURL(whatsappLink);
  };

  const handleGoToRegister = () => {
    navigation.navigate('Register', { phone: phone });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text variant="displaySmall" style={styles.title}>
            Ivoiredocs
          </Text>
          <Text variant="titleMedium" style={styles.subtitle}>
            Vos documents administratifs en toute simplicité
          </Text>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="headlineSmall" style={styles.cardTitle}>
              Connexion
            </Text>

            <TextInput
              label="Numéro de téléphone"
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (phoneError) setPhoneError('');
              }}
              keyboardType="phone-pad"
              autoCapitalize="none"
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="phone" />}
              placeholder="+225 XX XX XX XX XX"
              error={!!phoneError}
            />
            {phoneError ? (
              <Text style={styles.errorText}>{phoneError}</Text>
            ) : null}

            <TextInput
              label="Mot de passe"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) setPasswordError('');
              }}
              secureTextEntry={!showPassword}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="lock" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              error={!!passwordError}
            />
            {passwordError ? (
              <Text style={styles.errorText}>{passwordError}</Text>
            ) : null}

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              Se connecter
            </Button>

            <Button
              mode="text"
              onPress={handleForgotPassword}
              style={styles.linkButton}
              icon="whatsapp"
            >
              Mot de passe oublié ? Contactez-nous
            </Button>

            <Button
              mode="text"
              onPress={handleGoToRegister}
              style={styles.linkButton}
            >
              Pas de compte ? S'inscrire
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    color: '#10b981',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: '#6b7280',
    textAlign: 'center',
  },
  card: {
    borderRadius: 12,
  },
  cardTitle: {
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    marginBottom: 4,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    marginBottom: 12,
    marginLeft: 4,
  },
  button: {
    marginTop: 16,
    paddingVertical: 6,
  },
  linkButton: {
    marginTop: 8,
  },
});
