# Ivoiredocs Mobile - Application React Native

Application mobile React Native pour Ivoiredocs.ci - Plateforme de demandes de documents administratifs en Côte d'Ivoire.

## Stack Technique

- **Framework**: Expo (React Native)
- **UI Library**: React Native Paper (Material Design 3)
- **Navigation**: React Navigation v7
- **State Management**: Zustand
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Paiement**: KKiaPay SDK
- **Notifications**: Expo Notifications
- **TypeScript**: Strict mode

## Structure du Projet

```
ivoiredocs-mobile/
├── src/
│   ├── config/              # Configuration (Supabase, Theme)
│   ├── services/            # Services backend réutilisés du web
│   ├── stores/              # Zustand stores (auth, cart, toast)
│   ├── types/               # Types TypeScript
│   ├── utils/               # Utilitaires (documents, etc.)
│   ├── navigation/          # React Navigation setup
│   ├── screens/             # Écrans de l'app
│   ├── components/          # Composants réutilisables
│   └── hooks/               # Custom hooks
├── App.tsx                  # Point d'entrée
├── app.json                 # Configuration Expo
└── .env                     # Variables d'environnement
```

## Installation

1. **Cloner le projet** (déjà fait)

2. **Installer les dépendances** (déjà fait)
   ```bash
   npm install
   ```

3. **Configurer les variables d'environnement**

   Le fichier `.env` existe déjà avec les clés Supabase. Pour KKiaPay, ajoutez vos propres clés:
   ```env
   EXPO_PUBLIC_KKIAPAY_PUBLIC_KEY=votre_clé_publique
   EXPO_PUBLIC_KKIAPAY_PRIVATE_KEY=votre_clé_privée
   ```

## Développement

### Démarrer l'app en mode développement

```bash
npm start
```

Puis scannez le QR code avec:
- **Android**: Expo Go app
- **iOS**: Caméra native

### Lancer sur émulateur

```bash
# Android
npm run android

# iOS (Mac uniquement)
npm run ios
```

## État Actuel - Phase 1 + Phase 2 MVP Complétées ✅✅

### PHASE 1 - Setup + Authentification ✅:

1. ✅ **Setup complet**
   - Projet Expo avec TypeScript
   - Toutes les dépendances installées
   - Structure de dossiers créée

2. ✅ **Configuration**
   - Supabase client configuré
   - Theme React Native Paper (couleurs emerald)
   - Variables d'environnement (.env)
   - app.json avec permissions

3. ✅ **Services réutilisés du web** (100%)
   - `types/index.ts` - Types TypeScript
   - `utils/documents.ts` - Configuration documents + calculs prix
   - `services/delegateAssignmentService.ts` - Assignation automatique
   - `services/kkiapayService.ts` - Vérification paiements
   - `services/notifications.ts` - SMS notifications

4. ✅ **Stores Zustand**
   - `authStore.ts` - Authentification adaptée pour mobile
   - `toastStore.ts` - Notifications toast

5. ✅ **Navigation**
   - RootNavigator (auth guard)
   - AuthNavigator (login, register)
   - UserNavigator (tab navigation)
   - DelegateNavigator (tab navigation)

6. ✅ **Écrans d'authentification**
   - LoginScreen - Connexion avec email/password
   - RegisterScreen - Inscription complète
   - Design Material avec React Native Paper

### PHASE 2 - Dashboard + Création Demande ✅✅:

1. ✅ **Composants UI de base**
   - Button, Card, Badge, Loading - Material Design

2. ✅ **Services & Hooks**
   - requestService.ts - Service complet demandes
   - useRequests.ts - Hook avec auto-refresh
   - useImagePicker.ts - Hook photos avec permissions

3. ✅ **Composants Request**
   - RequestCard - Carte demande cliquable
   - RequestTimeline - Timeline visuelle animée
   - DocumentTypeCard - Carte sélection document
   - PhotoUploader - Upload multi-photos

4. ✅ **Écrans Fonctionnels Complets**
   - **DashboardScreen** - Liste demandes + pull-to-refresh + FAB
   - **RequestDetailScreen** - Timeline + infos complètes
   - **DocumentSelectionScreen** - Grille 8 types de documents
   - **RequestFormScreen** - Formulaire simplifié combiné
   - **PaymentScreen** - Intégration KKiaPay mobile

5. ✅ **Flow Complet de Création**
   - Sélection document → Formulaire → Upload photos → Paiement → Création

### Ce qui était fait (ancienne doc):

1. ✅ **Setup complet**
   - Projet Expo avec TypeScript
   - Toutes les dépendances installées
   - Structure de dossiers créée

2. ✅ **Configuration**
   - Supabase client configuré
   - Theme React Native Paper (couleurs emerald)
   - Variables d'environnement (.env)
   - app.json avec permissions

3. ✅ **Services réutilisés du web** (100%)
   - `types/index.ts` - Types TypeScript
   - `utils/documents.ts` - Configuration documents + calculs prix
   - `services/delegateAssignmentService.ts` - Assignation automatique
   - `services/kkiapayService.ts` - Vérification paiements
   - `services/notifications.ts` - SMS notifications

4. ✅ **Stores Zustand**
   - `authStore.ts` - Authentification adaptée pour mobile
   - `toastStore.ts` - Notifications toast

5. ✅ **Navigation**
   - RootNavigator (auth guard)
   - AuthNavigator (login, register)
   - UserNavigator (tab navigation)
   - DelegateNavigator (tab navigation)

6. ✅ **Écrans d'authentification**
   - LoginScreen - Connexion avec email/password
   - RegisterScreen - Inscription complète
   - Design Material avec React Native Paper

7. ✅ **Écrans placeholder**
   - DashboardScreen - Dashboard client
   - ProfileScreen - Profil utilisateur
   - DelegateDashboardScreen - Dashboard délégué

### À faire ensuite (Phase 3 - Dashboard Délégué):

1. **Dashboard Client complet**
   - Liste des demandes avec FlatList
   - Composant RequestCard
   - Navigation vers détails
   - Refresh pour recharger

2. **Création de demande simplifiée**
   - DocumentSelectionScreen (grille 8 types)
   - RequestFormScreen (formulaire combiné)
   - PhotoUploader (expo-image-picker)
   - PaymentScreen (KKiaPay SDK)

3. **Dashboard Délégué**
   - Liste missions actives
   - Actions dynamiques selon statut
   - Modal expédition
   - WhatsApp button

## Tester l'Application

### 1. Tester l'authentification

1. Lancer l'app: `npm start`
2. Ouvrir sur appareil/émulateur
3. Créer un compte via "S'inscrire"
4. Se connecter avec les identifiants

### 2. Comptes de test (base de données existante)

Vous pouvez utiliser les comptes existants de l'app web si la base Supabase est partagée.

## Prochaines Étapes

### Phase 2: Dashboard Client (Semaine 2 - Partie 1)

```bash
# Créer composants UI
src/components/ui/Button.tsx
src/components/ui/Card.tsx
src/components/request/RequestCard.tsx
src/components/request/RequestTimeline.tsx

# Créer écrans
src/screens/user/DashboardScreen.tsx (complet avec FlatList)
src/screens/user/RequestDetailScreen.tsx
```

### Phase 3: Création de Demande (Semaine 2 - Partie 2)

```bash
# Créer écrans
src/screens/request/DocumentSelectionScreen.tsx
src/screens/request/RequestFormScreen.tsx
src/screens/request/PaymentScreen.tsx

# Créer services
src/services/uploadService.ts (avec expo-file-system)
src/hooks/useImagePicker.ts
```

## Design System

### Couleurs (theme.ts)

- **Primary**: #10b981 (emerald-500) - Couleur principale
- **Secondary**: #f59e0b (amber-500) - Accents délégués
- **Background**: #f9fafb (gray-50)
- **Surface**: #ffffff
- **Error**: #ef4444 (red-500)

### Composants React Native Paper

Tous les écrans utilisent:
- `<Text variant="...">` pour typography
- `<Button mode="contained|outlined|text">`
- `<TextInput mode="outlined">`
- `<Card>` pour conteneurs

## Scripts Disponibles

```bash
npm start          # Démarrer dev server
npm run android    # Lancer sur Android
npm run ios        # Lancer sur iOS
npm run web        # Lancer sur web
```

## Troubleshooting

### Erreur "Metro bundler failed to start"
```bash
npx expo start --clear
```

### Erreur TypeScript
```bash
npm run tsc
```

### Permissions camera/photos non accordées
Vérifier `app.json` → plugins → expo-image-picker

## Documentation

- [Plan complet](C:\Users\Samsung\.claude\plans\peaceful-petting-rabin.md)
- [Expo Docs](https://docs.expo.dev)
- [React Native Paper](https://callstack.github.io/react-native-paper/)
- [React Navigation](https://reactnavigation.org)
- [Supabase JS](https://supabase.com/docs/reference/javascript)

---

**Version**: 1.0.0
**Dernière mise à jour**: 30 décembre 2025
**Statut**: Phase 1 + Phase 2 MVP Complétées ✅✅

## Flow Complet Testable

1. **Authentification** → Login/Register
2. **Dashboard** → Voir liste demandes + Pull-to-refresh
3. **Nouvelle Demande** → FAB → Sélection document
4. **Formulaire** → Remplir infos + Upload photos
5. **Paiement** → KKiaPay → Vérification → Création
6. **Tracking** → Voir détail + Timeline

**L'application est 100% fonctionnelle pour le MVP !** 🎉
