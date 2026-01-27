import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { Text, TextInput, Button, Card } from 'react-native-paper';
import { useAuthStore, AuthError, AUTH_ERROR_CODES } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { isValidIvorianPhone } from '../../utils/phoneValidation';

export default function RegisterScreen({ navigation, route }: any) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Erreurs par champ
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const signUp = useAuthStore((state) => state.signUp);

  // Pré-remplir le téléphone si passé depuis LoginScreen
  useEffect(() => {
    if (route.params?.phone) {
      setPhone(route.params.phone);
    }
  }, [route.params?.phone]);

  const clearErrors = () => {
    setNameError('');
    setPhoneError('');
    setPasswordError('');
    setConfirmPasswordError('');
  };

  const validateForm = (): boolean => {
    clearErrors();
    let isValid = true;

    // Validation du nom
    if (!name.trim()) {
      setNameError('Veuillez entrer votre nom complet');
      isValid = false;
    } else if (name.trim().length < 2) {
      setNameError('Le nom doit contenir au moins 2 caractères');
      isValid = false;
    }

    // Validation du téléphone
    if (!phone) {
      setPhoneError('Veuillez entrer votre numéro de téléphone');
      isValid = false;
    } else if (!isValidIvorianPhone(phone)) {
      setPhoneError('Numéro de téléphone invalide. Format: +225 XX XX XX XX XX');
      isValid = false;
    }

    // Validation du mot de passe
    if (!password) {
      setPasswordError('Veuillez entrer un mot de passe');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caractères');
      isValid = false;
    }

    // Validation de la confirmation
    if (!confirmPassword) {
      setConfirmPasswordError('Veuillez confirmer votre mot de passe');
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Les mots de passe ne correspondent pas');
      isValid = false;
    }

    return isValid;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await signUp(phone, password, name.trim());
      toast.success('Inscription réussie !');
    } catch (error: any) {
      console.error('Erreur d\'inscription:', error);

      if (error instanceof AuthError) {
        switch (error.code) {
          case AUTH_ERROR_CODES.PHONE_ALREADY_REGISTERED:
            setPhoneError('Ce numéro est déjà enregistré');
            toast.error('Ce numéro est déjà utilisé. Veuillez vous connecter.');
            break;
          default:
            toast.error(error.message || 'Erreur d\'inscription');
        }
      } else {
        toast.error('Erreur d\'inscription. Veuillez réessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Image
            source={require('../../../assets/logo-dark.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text variant="displaySmall" style={styles.title}>
            Inscription
          </Text>
          <Text variant="titleMedium" style={styles.subtitle}>
            Créez votre compte Ivoiredocs
          </Text>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Nom complet"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (nameError) setNameError('');
              }}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="account" />}
              error={!!nameError}
            />
            {nameError ? (
              <Text style={styles.errorText}>{nameError}</Text>
            ) : null}

            <TextInput
              label="Numéro de téléphone"
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (phoneError) setPhoneError('');
              }}
              keyboardType="phone-pad"
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

            <TextInput
              label="Confirmer le mot de passe"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (confirmPasswordError) setConfirmPasswordError('');
              }}
              secureTextEntry={!showPassword}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="lock-check" />}
              error={!!confirmPasswordError}
            />
            {confirmPasswordError ? (
              <Text style={styles.errorText}>{confirmPasswordError}</Text>
            ) : null}

            <Button
              mode="contained"
              onPress={handleRegister}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              S'inscrire
            </Button>

            <Button
              mode="text"
              onPress={() => navigation.navigate('Login')}
              style={styles.linkButton}
            >
              Déjà un compte ? Se connecter
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
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
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
