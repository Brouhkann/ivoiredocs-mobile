// Service de notifications (SMS, Email, Push)
import { supabase } from "../config/supabase";

interface NotificationData {
  to: string;
  message: string;
  type: "sms" | "email" | "push";
  template?: string;
  variables?: Record<string, string>;
}

interface SMSProvider {
  send(to: string, message: string): Promise<boolean>;
}

// Configuration des providers SMS via variables d'environnement
// IMPORTANT: Ne jamais hardcoder les credentials dans le code source
const SMS_PROVIDERS = {
  orangeCI: {
    baseUrl:
      "https://api.orange.com/smsmessaging/v1/outbound/tel%3A%2B2250000/requests",
    tokenUrl: "https://api.orange.com/oauth/v2/token",
    clientId: process.env.EXPO_PUBLIC_ORANGE_CLIENT_ID || "",
    clientSecret: process.env.EXPO_PUBLIC_ORANGE_CLIENT_SECRET || "",
    authHeader: process.env.EXPO_PUBLIC_ORANGE_AUTH_HEADER || "",
  },
  infobip: {
    baseUrl: "https://api.infobip.com/sms/2/text/advanced",
    apiKey: process.env.EXPO_PUBLIC_INFOBIP_API_KEY || "",
  },
  twilio: {
    baseUrl: "https://api.twilio.com/2010-04-01/Accounts",
    accountSid: process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID || "",
    authToken: process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN || "",
  },
};

class InfobipSMSProvider implements SMSProvider {
  async send(to: string, message: string): Promise<boolean> {
    try {
      const response = await fetch(SMS_PROVIDERS.infobip.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `App ${SMS_PROVIDERS.infobip.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              from: "Ivoiredocs",
              destinations: [{ to: to.replace(/\D/g, "") }],
              text: message,
            },
          ],
        }),
      });

      return response.ok;
    } catch (error) {
      console.error("Erreur envoi SMS Infobip:", error);
      return false;
    }
  }
}

class OrangeCISMSProvider implements SMSProvider {
  private formatIvoirianNumber(phoneNumber: string): string {
    // Nettoie et formate les numéros ivoiriens
    let clean = phoneNumber.replace(/\D/g, "");

    // Si le numéro commence par 0 (format local ivoirien), garde le 0
    if (clean.startsWith("0") && clean.length === 10) {
      clean = "225" + clean; // Garde tout le numéro: 0505000800 → 2250505000800
    }

    // Si pas de code pays, ajoute 225
    if (!clean.startsWith("225")) {
      clean = "225" + clean;
    }

    return "+" + clean;
  }

  async send(to: string, message: string): Promise<boolean> {
    try {
      const formattedNumber = this.formatIvoirianNumber(to);

      console.log(`📱 Envoi SMS Orange CI RÉEL vers ${formattedNumber}`);
      console.log(`💬 Message: ${message}`);
      console.log(`🔧 Provider: Orange CI (Edge Function Supabase)`);

      // Utiliser l'Edge Function Supabase corrigée
      console.log('🔗 Appel Edge Function Supabase...');
      const response = await supabase.functions.invoke('send-sms', {
        body: {
          to: to,
          message: message,
        },
      });

      if (response.error) {
        console.error("❌ Erreur Edge Function:", response.error);

        // Logger l'échec dans la base de données
        try {
          await supabase.from("notification_logs").insert({
            type: "sms",
            recipient: formattedNumber,
            message,
            status: "failed",
            provider: "orange-ci",
            error_message: response.error.message,
            metadata: {
              original_number: to,
              formatted_number: formattedNumber,
              edge_function: true,
              error_details: response.error
            }
          });
        } catch (logError) {
          console.warn("Impossible de logger dans notification_logs:", logError);
        }

        return false;
      }

      const success = response.data?.success || false;

      if (success) {
        console.log("✅ SMS Orange CI envoyé avec succès via Edge Function");
        console.log("📊 Réponse Orange CI:", response.data);
      } else {
        console.log("❌ Échec envoi SMS Orange CI:", response.data);
      }

      // Logger dans la base de données
      try {
        await supabase.from("notification_logs").insert({
          type: "sms",
          recipient: formattedNumber,
          message,
          status: success ? "sent" : "failed",
          provider: "orange-ci",
          error_message: success ? null : response.data?.error,
          metadata: {
            original_number: to,
            formatted_number: formattedNumber,
            edge_function: true,
            orange_response: response.data
          }
        });
      } catch (logError) {
        console.warn("Impossible de logger dans notification_logs:", logError);
      }

      return success;
    } catch (error) {
      console.error("❌ Erreur envoi SMS Orange CI:", error);

      // Logger l'erreur
      try {
        await supabase.from("notification_logs").insert({
          type: "sms",
          recipient: to,
          message,
          status: "failed",
          provider: "orange-ci",
          error_message: error.message,
          metadata: {
            edge_function: true,
            error_type: "network_error"
          }
        });
      } catch (logError) {
        console.warn("Impossible de logger dans notification_logs:", logError);
      }

      return false;
    }
  }
}

class MockSMSProvider implements SMSProvider {
  async send(to: string, message: string): Promise<boolean> {
    // Mock provider for development
    console.log(`📱 SMS to ${to}: ${message}`);

    // Log to Supabase for tracking (ignore errors if table doesn't exist)
    try {
      await supabase.from("notification_logs").insert({
        type: "sms",
        recipient: to,
        message,
        status: "sent",
        provider: "mock",
      });
    } catch (error) {
      console.warn("Impossible de logger dans notification_logs:", error);
    }

    return true;
  }
}

// Sélection du provider selon l'environnement
// Orange CI est utilisé si les credentials sont configurés (même ceux par défaut pour les tests)
const smsProvider: SMSProvider =
  SMS_PROVIDERS.orangeCI.clientId && SMS_PROVIDERS.orangeCI.clientSecret
    ? new OrangeCISMSProvider()
    : SMS_PROVIDERS.infobip.apiKey
      ? new InfobipSMSProvider()
      : new MockSMSProvider();

console.log("🔔 SMS Provider sélectionné:",
  SMS_PROVIDERS.orangeCI.clientId && SMS_PROVIDERS.orangeCI.clientSecret
    ? "Orange CI"
    : SMS_PROVIDERS.infobip.apiKey
      ? "Infobip"
      : "Mock"
);

// Templates de messages - Workflow personnalisé Ivoiredocs.com
const MESSAGE_TEMPLATES = {
  // 1. 👤 Jean commande un acte de naissance
  order_confirmation: (variables: Record<string, string>) =>
    `Salut ${variables.name}! Votre commande a bien été reçue, notre délégué à ${variables.city} s'en occupe au plus vite - Ivoiredocs.com`,

  // 2. 🤝 Délégué Kouamé assigné
  delegate_new_mission: (variables: Record<string, string>) =>
    `Nouvelle mission pour vous: ${variables.document}, merci de vous en occuper - Ivoiredocs.com`,

  // 3. 🏃 Kouamé récupère le document - Version récupération sur place
  document_ready_pickup: (variables: Record<string, string>) =>
    `Votre document est prêt, vous pouvez passer le récupérer à la ${variables.serviceType} de ${variables.city} - Ivoiredocs.com`,

  // 3. 🏃 Kouamé récupère le document - Version expédition
  document_ready_shipping: (variables: Record<string, string>) =>
    `Votre document est prêt et sera expédié d'ici peu - Ivoiredocs.com`,

  // 4. 🚛 Kouamé a expédié les documents
  document_shipped: (variables: Record<string, string>) =>
    `Votre document a été expédié par ${variables.transportCompany} avec pour code retrait "${variables.retrievalCode}". Appelez au besoin ce numéro: ${variables.supportPhone} - Ivoiredocs.com`,

  // Messages existants gardés pour compatibilité
  delegate_assigned: (variables: Record<string, string>) =>
    `Votre demande #${variables.orderNumber} est confiée à un délégué. - Ivoiredocs.com`,

  order_delivered: (variables: Record<string, string>) =>
    `Document livré! Comment ça s'est passé? Notez votre délégué: ${variables.ratingUrl} - Ivoiredocs.com`,

  payment_received: (variables: Record<string, string>) =>
    `Paiement ${variables.amount} FCFA reçu pour ${variables.document}. On traite maintenant. Merci! - Ivoiredocs.com`,

  payment_pending: (variables: Record<string, string>) =>
    `Demande #${variables.orderNumber} attend paiement: ${variables.amount} FCFA. Orange Money/MTN: ${variables.paymentPhone}`,

  reminder_rating: (variables: Record<string, string>) =>
    `Akwaba! Comment c'était avec votre délégué? Votre avis: ${variables.ratingUrl} - Ivoiredocs.com`,

  welcome_new_user: (variables: Record<string, string>) =>
    `Bienvenue ${variables.name} sur Ivoiredocs.com! Documents en un clic. Support: ${variables.supportPhone}`,

  delegate_rating_received: (variables: Record<string, string>) =>
    `⭐ Bravo! Note: ${variables.rating}/5. "${variables.comment}". Continue! - Ivoiredocs.com`,

  admin_new_request: (variables: Record<string, string>) =>
    `📋 ADMIN: Demande #${variables.orderNumber} - ${variables.document} à ${variables.city}. Dashboard: ${variables.adminUrl}`,

  low_delegate_availability: (variables: Record<string, string>) =>
    `⚠️ ALERTE: Peu de délégués libres à ${variables.city}. ${variables.pendingRequests} demandes en attente!`,
};

export class NotificationService {
  // Envoyer SMS avec template
  static async sendSMS(
    to: string,
    template: string,
    variables: Record<string, string> = {},
  ): Promise<boolean> {
    try {
      const messageTemplate =
        MESSAGE_TEMPLATES[template as keyof typeof MESSAGE_TEMPLATES];
      if (!messageTemplate) {
        throw new Error(`Template SMS inexistant: ${template}`);
      }

      const message = messageTemplate(variables);
      const success = await smsProvider.send(to, message);

      // Log dans Supabase (ignore les erreurs si la table n'existe pas)
      try {
        await supabase.from("notification_logs").insert({
          type: "sms",
          recipient: to,
          template,
          message,
          status: success ? "sent" : "failed",
          variables,
        });
      } catch (logError) {
        console.warn("Impossible de logger dans notification_logs:", logError);
      }

      return success;
    } catch (error) {
      console.error("Erreur envoi SMS:", error);
      return false;
    }
  }

  // Envoyer SMS personnalisé (sans template)
  static async sendCustomSMS(
    to: string,
    message: string,
  ): Promise<boolean> {
    try {
      const success = await smsProvider.send(to, message);

      // Log dans Supabase (ignore les erreurs si la table n'existe pas)
      try {
        await supabase.from("notification_logs").insert({
          type: "sms",
          recipient: to,
          message,
          status: success ? "sent" : "failed",
          template: null,
          variables: null,
        });
      } catch (logError) {
        console.warn("Impossible de logger dans notification_logs:", logError);
      }

      return success;
    } catch (error) {
      console.error("Erreur envoi SMS personnalisé:", error);
      return false;
    }
  }

  // Envoyer Email (via Supabase Edge Functions)
  static async sendEmail(
    to: string,
    subject: string,
    content: string,
  ): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to,
          subject,
          html: content,
          from: "noreply@ivoiredocs.com",
        },
      });

      const success = !error;

      // Log dans Supabase
      await supabase.from("notification_logs").insert({
        type: "email",
        recipient: to,
        message: content,
        status: success ? "sent" : "failed",
        metadata: { subject },
      });

      return success;
    } catch (error) {
      console.error("Erreur envoi Email:", error);
      return false;
    }
  }

  // Notifications automatiques selon status commande
  static async notifyOrderStatusChange(
    orderId: string,
    newStatus: string,
  ): Promise<void> {
    try {
      // Récupérer info commande et utilisateur
      const { data: order, error } = await supabase
        .from("requests")
        .select(
          `
          *,
          users (name, phone, email),
          delegates (name, phone)
        `,
        )
        .eq("id", orderId)
        .single();

      if (error || !order) {
        console.error("Commande introuvable:", orderId);
        return;
      }

      const user = (order as any).users;
      const delegate = (order as any).delegates;
      // Deep linking pour mobile (ou URL web si disponible)
      const baseUrl = typeof window !== 'undefined' ? window.location?.origin : 'https://ivoiredocs.com';
      const trackingUrl = `${baseUrl}/requests/${orderId}`;
      const ratingUrl = `${trackingUrl}#rating`;

      const variables = {
        name: user.name,
        orderNumber: order.id.slice(-8).toUpperCase(),
        document: order.document_type,
        amount: order.total_amount.toLocaleString(),
        trackingUrl,
        ratingUrl,
        delegateName: delegate?.name || "",
        delegatePhone: delegate?.phone || "",
      };

      // Envoyer SMS selon le nouveau status
      switch (newStatus) {
        case "assigned":
          if (delegate) {
            await this.sendSMS(user.phone, "delegate_assigned", variables);
          }
          break;

        case "completed":
          await this.sendSMS(user.phone, "order_ready", variables);
          break;

        case "delivered":
          await this.sendSMS(user.phone, "order_delivered", variables);
          // Programmer rappel notation après 24h
          setTimeout(
            () => {
              this.sendSMS(user.phone, "reminder_rating", variables);
            },
            24 * 60 * 60 * 1000,
          );
          break;
      }
    } catch (error) {
      console.error("Erreur notification status:", error);
    }
  }

  // Notification confirmation paiement
  static async notifyPaymentReceived(orderId: string): Promise<void> {
    try {
      const { data: order, error } = await supabase
        .from("requests")
        .select(
          `
          *,
          users (name, phone)
        `,
        )
        .eq("id", orderId)
        .single();

      if (error || !order) return;

      const user = (order as any).users;
      const baseUrl = typeof window !== 'undefined' ? window.location?.origin : 'https://ivoiredocs.com';
      const variables = {
        name: user.name,
        orderNumber: order.id.slice(-8).toUpperCase(),
        document: order.document_type,
        amount: order.total_amount.toLocaleString(),
        trackingUrl: `${baseUrl}/requests/${orderId}`,
      };

      await this.sendSMS(user.phone, "payment_received", variables);
    } catch (error) {
      console.error("Erreur notification paiement:", error);
    }
  }

  // Push notifications (pour PWA/mobile apps)
  static async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    url?: string,
  ): Promise<boolean> {
    try {
      // Vérifier si l'utilisateur a autorisé les notifications
      // Note: Ne fonctionne que sur web, pas en React Native
      if (typeof window === 'undefined' || !("Notification" in window)) {
        return false;
      }

      if (Notification.permission === "granted") {
        const notification = new Notification(title, {
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: `ivoiredocs-${Date.now()}`,
          requireInteraction: true,
        });

        if (url) {
          notification.onclick = () => {
            window.open(url, "_blank");
            notification.close();
          };
        }

        // Log dans Supabase
        await supabase.from("notification_logs").insert({
          type: "push",
          recipient: userId,
          message: `${title}: ${body}`,
          status: "sent",
          metadata: { title, body, url },
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error("Erreur push notification:", error);
      return false;
    }
  }

  // Demander permission notifications push
  static async requestNotificationPermission(): Promise<boolean> {
    try {
      // Note: Ne fonctionne que sur web, pas en React Native
      if (typeof window === 'undefined' || !("Notification" in window)) {
        return false;
      }

      if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        return permission === "granted";
      }

      return Notification.permission === "granted";
    } catch (error) {
      console.error("Erreur permission notification:", error);
      return false;
    }
  }

  // === NOUVELLES MÉTHODES SPÉCIFIQUES CÔTE D'IVOIRE ===

  // Notification bienvenue nouveau utilisateur
  static async notifyWelcomeNewUser(userId: string): Promise<void> {
    try {
      const { data: user, error } = await supabase
        .from("users")
        .select("name, phone")
        .eq("id", userId)
        .single();

      if (error || !user) return;

      const variables = {
        name: user.name,
        supportPhone: "+225XXXXXXXX", // À configurer
      };

      await this.sendSMS(user.phone, "welcome_new_user", variables);
    } catch (error) {
      console.error("Erreur notification bienvenue:", error);
    }
  }

  // Notification rappel de paiement avec Orange Money/MTN
  static async notifyPaymentPending(orderId: string): Promise<void> {
    try {
      const { data: order, error } = await supabase
        .from("requests")
        .select(
          `
          *,
          users (name, phone)
        `,
        )
        .eq("id", orderId)
        .single();

      if (error || !order) return;

      const user = (order as any).users;
      const variables = {
        orderNumber: order.id.slice(-8).toUpperCase(),
        amount: order.total_amount.toLocaleString(),
        paymentPhone: "+225XXXXXXXX", // Numéro Orange Money/MTN
      };

      await this.sendSMS(user.phone, "payment_pending", variables);
    } catch (error) {
      console.error("Erreur notification paiement en attente:", error);
    }
  }

  // Notification délégué en route
  static async notifyDelegateEnRoute(
    orderId: string,
    estimatedTime: string,
  ): Promise<void> {
    try {
      const { data: order, error } = await supabase
        .from("requests")
        .select(
          `
          *,
          users (name, phone),
          delegates (name, phone)
        `,
        )
        .eq("id", orderId)
        .single();

      if (error || !order) return;

      const user = (order as any).users;
      const delegate = (order as any).delegates;

      const variables = {
        delegateName: delegate?.name || "Votre délégué",
        estimatedTime,
        delegatePhone: delegate?.phone || "",
      };

      await this.sendSMS(user.phone, "delegate_en_route", variables);
    } catch (error) {
      console.error("Erreur notification délégué en route:", error);
    }
  }

  // Notification nouvelle mission pour délégués
  static async notifyDelegateNewMission(
    delegateId: string,
    orderId: string,
  ): Promise<void> {
    try {
      const { data: delegate, error: delegateError } = await supabase
        .from("users")
        .select("name, phone")
        .eq("id", delegateId)
        .eq("role", "delegate")
        .single();

      const { data: order, error: orderError } = await supabase
        .from("requests")
        .select("document_type, city, total_amount")
        .eq("id", orderId)
        .single();

      if (delegateError || orderError || !delegate || !order) return;

      const baseUrl = typeof window !== 'undefined' ? window.location?.origin : 'https://ivoiredocs.com';
      const variables = {
        document: order.document_type,
        city: order.city,
        amount: (order.total_amount * 0.2).toLocaleString(), // 20% commission délégué
        trackingUrl: `${baseUrl}/delegate/missions/${orderId}`,
      };

      await this.sendSMS(delegate.phone, "delegate_new_mission", variables);
    } catch (error) {
      console.error("Erreur notification nouvelle mission:", error);
    }
  }

  // === NOUVELLES MÉTHODES WORKFLOW PERSONNALISÉ ===

  // Extraire le type de service dynamiquement
  static getServiceType(order: any): string {
    const formData = order.form_data || {};
    const serviceAdmin = formData.service_admin;
    const serviceType = serviceAdmin || order.service_type || "service";

    switch (serviceType) {
      case "mairie":
        return "mairie";
      case "sous_prefecture":
        return "sous-préfecture";
      case "justice":
        return "service de justice";
      case "mairie/sous-préfecture":
        return "mairie/sous-préfecture";
      default:
        return "service";
    }
  }

  // Extraire les informations de transport
  static getTransportInfo(order: any): { company: string; code: string } {
    const deliveryData = order.form_data?.delivery_data || {};
    const moyenExpedition = deliveryData.moyen_expedition;
    const preferenceTransport = deliveryData.preference_transport;

    let company = "Compagnie au choix";
    if (moyenExpedition === "utb") {
      company = "UTB";
    } else if (moyenExpedition === "transport_classique" && preferenceTransport) {
      company = preferenceTransport.trim();
    } else if (moyenExpedition === "expedition_abidjan") {
      company = "Expédition par Abidjan";
    }

    // Générer un code de retrait simulé
    const code = `${order.id.slice(-4).toUpperCase()}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;

    return { company, code };
  }

  // Déterminer si c'est une livraison ou récupération
  static isShippingDelivery(order: any): boolean {
    const deliveryData = order.form_data?.delivery_data || {};
    const moyenRecuperation = deliveryData.moyen_recuperation;
    return moyenRecuperation === "moi_meme_gare" || moyenRecuperation === "livraison_express";
  }

  // 1. Notification confirmation commande
  static async notifyOrderConfirmation(orderId: string): Promise<void> {
    try {
      const { data: order, error } = await supabase
        .from("requests")
        .select(`
          *,
          users (name, phone)
        `)
        .eq("id", orderId)
        .single();

      if (error || !order) {
        console.error("Commande introuvable:", orderId);
        return;
      }

      const user = (order as any).users;
      const variables = {
        name: user.name,
        city: order.city,
      };

      await this.sendSMS(user.phone, "order_confirmation", variables);
      console.log(`✅ SMS confirmation envoyé à ${user.phone}`);
    } catch (error) {
      console.error("Erreur notification confirmation:", error);
    }
  }

  // 2. Notification nouvelle mission délégué (version workflow)
  static async notifyDelegateNewMissionWorkflow(
    delegateId: string,
    orderId: string,
  ): Promise<void> {
    try {
      const { data: delegate, error: delegateError } = await supabase
        .from("users")
        .select("name, phone")
        .eq("id", delegateId)
        .eq("role", "delegate")
        .single();

      const { data: order, error: orderError } = await supabase
        .from("requests")
        .select("document_type, city")
        .eq("id", orderId)
        .single();

      if (delegateError || orderError || !delegate || !order) {
        console.error("Données introuvables pour mission délégué");
        return;
      }

      const variables = {
        document: order.document_type,
      };

      await this.sendSMS(delegate.phone, "delegate_new_mission", variables);
      console.log(`✅ SMS mission envoyé au délégué ${delegate.phone}`);
    } catch (error) {
      console.error("Erreur notification mission délégué:", error);
    }
  }

  // 3. Notification document prêt (pickup ou shipping)
  static async notifyDocumentReady(orderId: string): Promise<void> {
    try {
      const { data: order, error } = await supabase
        .from("requests")
        .select(`
          *,
          users (name, phone)
        `)
        .eq("id", orderId)
        .single();

      if (error || !order) {
        console.error("Commande introuvable:", orderId);
        return;
      }

      const user = (order as any).users;
      const isShipping = this.isShippingDelivery(order);

      if (isShipping) {
        // Version expédition
        await this.sendSMS(user.phone, "document_ready_shipping", {});
        console.log(`✅ SMS document prêt (expédition) envoyé à ${user.phone}`);
      } else {
        // Version récupération sur place
        const serviceType = this.getServiceType(order);
        const variables = {
          serviceType,
          city: order.city,
        };
        await this.sendSMS(user.phone, "document_ready_pickup", variables);
        console.log(`✅ SMS document prêt (récupération) envoyé à ${user.phone}`);
      }
    } catch (error) {
      console.error("Erreur notification document prêt:", error);
    }
  }

  // 4. Notification document expédié
  static async notifyDocumentShipped(orderId: string): Promise<void> {
    try {
      const { data: order, error } = await supabase
        .from("requests")
        .select(`
          *,
          users (name, phone)
        `)
        .eq("id", orderId)
        .single();

      if (error || !order) {
        console.error("Commande introuvable:", orderId);
        return;
      }

      const user = (order as any).users;
      const { company, code } = this.getTransportInfo(order);

      const variables = {
        transportCompany: company,
        retrievalCode: code,
        supportPhone: "+225XXXXXXXX", // À configurer
      };

      await this.sendSMS(user.phone, "document_shipped", variables);
      console.log(`✅ SMS expédition envoyé à ${user.phone}`);
    } catch (error) {
      console.error("Erreur notification expédition:", error);
    }
  }

  // Workflow complet personnalisé Ivoiredocs.com
  static async processCustomWorkflow(
    orderId: string,
    workflowStep: string,
    extraData?: any,
  ): Promise<void> {
    try {
      console.log(
        `🔔 Processing custom workflow for order ${orderId} - Step: ${workflowStep}`,
      );

      switch (workflowStep) {
        case "order_created":
          // 1. 👤 Jean commande un acte de naissance
          await this.notifyOrderConfirmation(orderId);
          break;

        case "delegate_assigned":
          // 2. 🤝 Délégué Kouamé assigné
          if (extraData?.delegateId) {
            await this.notifyDelegateNewMissionWorkflow(extraData.delegateId, orderId);
          }
          break;

        case "document_ready":
          // 3. 🏃 Kouamé récupère le document
          await this.notifyDocumentReady(orderId);
          break;

        case "document_shipped":
          // 4. 🚛 Kouamé a expédié les documents
          await this.notifyDocumentShipped(orderId);
          break;

        default:
          console.log(`Workflow step ${workflowStep} non géré`);
      }
    } catch (error) {
      console.error("Erreur dans workflow personnalisé:", error);
    }
  }

  // Workflow complet de notifications automatiques (conservé pour compatibilité)
  static async processOrderWorkflow(
    orderId: string,
    newStatus: string,
    extraData?: any,
  ): Promise<void> {
    try {
      console.log(
        `🔔 Processing notification workflow for order ${orderId} - Status: ${newStatus}`,
      );

      switch (newStatus) {
        case "pending":
          // Inscription → Confirmation reçue
          await this.notifyOrderStatusChange(orderId, "pending");
          break;

        case "payment_pending":
          // Demande créée → Attente paiement
          await this.notifyPaymentPending(orderId);
          break;

        case "paid":
          // Paiement reçu → Traitement en cours
          await this.notifyPaymentReceived(orderId);
          break;

        case "assigned":
          // Délégué assigné
          await this.notifyOrderStatusChange(orderId, "assigned");
          if (extraData?.delegateId) {
            await this.notifyDelegateNewMission(extraData.delegateId, orderId);
          }
          break;

        case "delegate_en_route":
          // Délégué en route pour livraison
          await this.notifyDelegateEnRoute(
            orderId,
            extraData?.estimatedTime || "30 min",
          );
          break;

        case "completed":
          // Document prêt pour livraison
          await this.notifyOrderStatusChange(orderId, "completed");
          break;

        case "delivered":
          // Document livré avec succès
          await this.notifyOrderStatusChange(orderId, "delivered");
          break;

        default:
          console.log(`Status ${newStatus} non géré dans le workflow`);
      }
    } catch (error) {
      console.error("Erreur dans workflow notifications:", error);
    }
  }
}

export default NotificationService;
