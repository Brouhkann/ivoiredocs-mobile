/**
 * Utilitaires de validation et formatage des numéros de téléphone ivoiriens
 */

// Numéro WhatsApp du support pour la réinitialisation du mot de passe
export const SUPPORT_WHATSAPP_NUMBER = '2250545703076';

/**
 * Valide un numéro de téléphone ivoirien
 * Formats acceptés: +225XXXXXXXXXX, 225XXXXXXXXXX, 0XXXXXXXXX, XXXXXXXXXX
 * Les numéros ivoiriens ont 10 chiffres après l'indicatif (+225)
 */
export function isValidIvorianPhone(phone: string): boolean {
  // Nettoyer le numéro
  const cleaned = phone.replace(/[\s\-\.\(\)]/g, '');

  // Format +225XXXXXXXXXX (10 chiffres après +225)
  if (/^\+225\d{10}$/.test(cleaned)) {
    return true;
  }

  // Format 225XXXXXXXXXX (10 chiffres après 225)
  if (/^225\d{10}$/.test(cleaned)) {
    return true;
  }

  // Format 0XXXXXXXXX (10 chiffres commençant par 0)
  if (/^0\d{9}$/.test(cleaned)) {
    return true;
  }

  // Format XXXXXXXXXX (10 chiffres sans préfixe, commence par 0, 1, 2, 5, ou 7)
  if (/^[01257]\d{9}$/.test(cleaned)) {
    return true;
  }

  return false;
}

/**
 * Normalise un numéro de téléphone au format international ivoirien
 * Format: +225 suivi des 10 chiffres (total 14 caractères)
 * Exemple: 0505000000 -> +2250505000000
 */
export function normalizePhone(phone: string): string {
  // Nettoyer le numéro (retirer espaces, tirets, points, parenthèses)
  let cleaned = phone.replace(/[\s\-\.\(\)]/g, '');

  // Si déjà au format +2250XXXXXXXX (14 chars), garder tel quel
  if (cleaned.startsWith('+2250') && cleaned.length === 14) {
    return cleaned;
  }

  // Si format +225XXXXXXXX sans le 0 (13 chars), ajouter le 0
  if (cleaned.startsWith('+225') && cleaned.length === 13 && cleaned[4] !== '0') {
    return '+2250' + cleaned.substring(4);
  }

  // Si commence par +225, garder tel quel
  if (cleaned.startsWith('+225')) {
    return cleaned;
  }

  // Si commence par 2250 (sans +), ajouter +
  if (cleaned.startsWith('2250') && cleaned.length === 13) {
    return '+' + cleaned;
  }

  // Si commence par 225 sans le 0 (12 chars), ajouter +225 et le 0
  if (cleaned.startsWith('225') && cleaned.length === 12) {
    return '+2250' + cleaned.substring(3);
  }

  // Si commence par 0 (format local ivoirien 10 chiffres)
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '+225' + cleaned;
  }

  // Si 9 chiffres sans le 0, ajouter +2250
  if (cleaned.length === 9 && /^\d+$/.test(cleaned)) {
    return '+2250' + cleaned;
  }

  // Par défaut, ajouter +225
  return '+225' + cleaned;
}

/**
 * Formate un numéro pour l'affichage: +225 05 05 00 00 00
 */
export function formatPhoneForDisplay(phone: string): string {
  const normalized = normalizePhone(phone);

  // +2250505000000 = 14 caractères -> +225 05 05 00 00 00
  if (normalized.length === 14) {
    return `${normalized.slice(0, 4)} ${normalized.slice(4, 6)} ${normalized.slice(6, 8)} ${normalized.slice(8, 10)} ${normalized.slice(10, 12)} ${normalized.slice(12, 14)}`;
  }

  return normalized;
}

/**
 * Génère un email fictif à partir du numéro de téléphone pour Supabase Auth
 * +2250505000800 -> 2250505000800@phone.ivoiredocs.ci
 */
export function phoneToFakeEmail(phone: string): string {
  const normalized = normalizePhone(phone);
  // Retirer le + pour l'email
  const phoneDigits = normalized.replace('+', '');
  return `${phoneDigits}@phone.ivoiredocs.ci`;
}

/**
 * Extrait le numéro de téléphone d'un email fictif
 * 2250505000800@phone.ivoiredocs.ci -> +2250505000800
 */
export function fakeEmailToPhone(email: string): string | null {
  const match = email.match(/^(\d+)@phone\.ivoiredocs\.ci$/);
  if (match) {
    return '+' + match[1];
  }
  return null;
}

/**
 * Génère le lien WhatsApp pour contacter le support (mot de passe oublié)
 */
export function getWhatsAppSupportLink(phone?: string): string {
  const message = encodeURIComponent(
    phone
      ? `Bonjour, j'ai oublié mon mot de passe pour mon compte Ivoiredocs associé au numéro ${phone}. Pouvez-vous m'aider à le réinitialiser ?`
      : `Bonjour, j'ai oublié mon mot de passe pour mon compte Ivoiredocs. Pouvez-vous m'aider à le réinitialiser ?`
  );
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${message}`;
}
