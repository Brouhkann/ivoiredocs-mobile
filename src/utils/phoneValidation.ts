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
 * Normalise un numéro de téléphone au format +225XXXXXXXXXX
 */
export function normalizePhone(phone: string): string {
  // Nettoyer le numéro
  let cleaned = phone.replace(/[\s\-\.\(\)]/g, '');

  // Si commence par +225, garder tel quel
  if (cleaned.startsWith('+225')) {
    return cleaned;
  }

  // Si commence par 225, ajouter +
  if (cleaned.startsWith('225')) {
    return '+' + cleaned;
  }

  // Si commence par 0, remplacer par +225
  if (cleaned.startsWith('0')) {
    return '+225' + cleaned.substring(1);
  }

  // Sinon, ajouter +225
  return '+225' + cleaned;
}

/**
 * Formate un numéro pour l'affichage: +225 XX XX XX XX XX
 */
export function formatPhoneForDisplay(phone: string): string {
  const normalized = normalizePhone(phone);

  // +225 XX XX XX XX XX
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
