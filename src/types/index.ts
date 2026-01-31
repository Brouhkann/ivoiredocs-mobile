// Types principaux pour Ivoiredocs.com
export type UserRole = "user" | "delegate" | "admin" | "support" | "driver";

// Énumérations - Types de documents et services (déclarés en premier)
export type DocumentType =
  | "declaration_naissance"
  | "extrait_acte_naissance"
  | "copie_integrale_naissance"
  | "extrait_acte_mariage"
  | "copie_integrale_mariage"
  | "certificat_celibat"
  | "certificat_non_divorce"
  | "certificat_residence";

export type ServiceType =
  | "mairie"
  | "sous_prefecture"
  | "justice"
  | "mairie/sous-préfecture";

export type RequestStatus =
  | "new"
  | "assigned"
  | "in_progress"
  | "ready"
  | "shipped"
  | "in_transit"
  | "delivered"
  | "completed"
  | "cancelled";

export interface UserPreferences {
  notifications: boolean;
  default_city: string;
  preferred_shipping: string;
}

export interface User {
  id: string;
  email: string;
  phone: string;
  name: string;
  role?: UserRole;
  preferences?: UserPreferences;
  created_at: string;
  total_requests: number;
}

export interface Delegate {
  id: string;
  name: string;
  city: string;
  services: ServiceType[];
  is_active: boolean;
  rating: number;
  total_requests: number;
  total_earnings: number;
}

// Détail de facturation figé au moment de la création
export interface BillingDetails {
  documents: Array<{
    document_type: DocumentType;
    document_name: string;
    copies: number;
    unit_price: number;
    total_price: number;
  }>;
  prestation: {
    description: string;
    amount: number;
  };
  shipping?: {
    description: string;
    amount: number;
  };
  express_delivery?: {
    description: string;
    amount: number;
  };
  total_amount: number;
  payment_breakdown: {
    documents_subtotal: number;
    prestation_fee: number;
    shipping_fee: number;
    express_fee: number;
  };
}

export interface RequestAttachment {
  id: string;
  request_id: string;
  file_name: string;
  file_url?: string;
  file_type: string;
  file_size?: number;
  storage_path?: string;
  created_at: string;
}

export interface Request {
  id: string;
  user_id: string;
  delegate_id?: string;
  document_type: DocumentType;
  service_type: ServiceType;
  status: RequestStatus;
  city: string;
  copies: number;
  total_amount: number;
  delegate_earnings: number;
  delegate_dotation?: number; // Dotation calculée et figée en base de données
  delegate_payment_status?: 'pending' | 'paid'; // Statut du paiement de la dotation
  delegate_payment_proof_url?: string; // URL de la preuve de paiement
  delegate_paid_at?: string; // Date du paiement de la dotation
  document_price?: number;
  service_price?: number;
  shipping_price?: number;
  delivery_price?: number;
  // billing_details?: BillingDetails; // Temporairement désactivé - colonne n'existe pas en DB
  created_at: string; // Demande en ligne
  estimated_completion?: string;
  assigned_at?: string; // Attribution au délégué
  started_at?: string; // Début du traitement (délégué clique "commencer")
  ready_at?: string; // Document prêt (délégué clique "document prêt")
  shipped_at?: string; // Document expédié (délégué clique "document expédié")
  shipping_company?: string; // Compagnie de transport utilisée
  shipping_code?: string; // Code de retrait pour le client
  shipping_contact?: string; // Contact de la compagnie de transport
  shipping_receipt_photo?: string; // URL de la photo du reçu d'expédition
  delivered_at?: string; // Document livré (client confirme ou admin valide)
  completed_at?: string; // Processus terminé
  driver_id?: string;
  delivery_sector_id?: string;
  delivery_zone_id?: string;
  pickup_zone_id?: string;
  in_transit_at?: string;
  delivery_proof_photo?: string;
  delivery_code?: string;
  form_data?: any;
  attachments?: RequestAttachment[]; // Pièces jointes
}

export interface DelegateRating {
  id: string;
  request_id: string;
  delegate_id: string;
  user_id: string;
  overall_rating: number;
  speed_rating: number;
  quality_rating: number;
  communication_rating: number;
  comment?: string;
  created_at: string;
}

// Types déjà déclarés plus haut dans le fichier

export interface RequestFormData {
  document_type: DocumentType;
  copies: number;
  form_data?: any;
  uploaded_files?: File[];
}

// Configuration des documents
export interface DocumentConfig {
  type: DocumentType;
  name: string;
  service: ServiceType;
  base_price: number;
  processing_time: string; // délai flexible comme "bref délai"
  required_fields: string[];
  required_documents: string[]; // Pièces justificatives requises
}

// Configuration de prix
export interface PricingConfig {
  base_price: number;
  city_multiplier: number;
  delegate_bonus: number;
  shipping_cost: number;
}

// Types pour le Dashboard Support
export interface SupportStats {
  // Clients
  totalUsers: number;
  newUsersToday: number;
  activeUsersLast30Days: number;

  // Délégués
  totalDelegates: number;
  activeDelegates: number;
  delegatesOffline: number;
  averageDelegateRating: number;

  // Demandes & Missions
  totalRequests: number;
  pendingRequests: number;
  completedToday: number;
  averageProcessingTime: number;

  // Revenue & Performance
  totalRevenue: number;
  revenueToday: number;
  successRate: number;
  customerSatisfaction: number;
}

export interface SupportAlert {
  id: string;
  type: "urgent" | "warning" | "info";
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  actionUrl?: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  category: "technical" | "billing" | "general" | "complaint";
}

export interface DelegatePerformance {
  delegate_id: string;
  name: string;
  city: string;
  // Performance metrics
  averageProcessingTime: number; // heures
  missionsThisMonth: number;
  averageMissionsPerMonth: number;
  dotationThisMonth: number;
  averageDotationPerMonth: number;
  // Ratings
  averageRating: number;
  totalRatings: number;
  // Status
  isActive: boolean;
  lastActivity: string;
}

export interface RequestAlert {
  id: string;
  request_id: string;
  type: "overdue_processing" | "overdue_delivery" | "unassigned" | "complaint";
  message: string;
  created_at: string;
  severity: "low" | "medium" | "high";
}

// Types Livraison Express
export interface DeliveryZone {
  id: string;
  name: string;
  code: string;
  communes: string[];
  is_active: boolean;
  display_order: number;
}

export interface DeliverySector {
  id: string;
  zone_id: string;
  commune: string;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  display_order: number;
}

export interface DeliveryPricingConfig {
  id: string;
  base_fee: number;
  per_km_rate: number;
  road_factor: number;
  rounding: number;
  min_price: number;
  max_price: number;
  updated_at: string;
}

export interface Driver {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  zone_id?: string;
  is_active: boolean;
  is_available: boolean;
  total_deliveries: number;
  rating: number;
  mobile_money_contact?: string;
}

export interface CommunePickupPoint {
  id: string;
  commune: string;
  name: string;
  latitude: number;
  longitude: number;
}
