-- Table des factures pour le paiement Wave
-- Permet de tracker les demandes en attente de paiement

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL, -- IV-20240124-A7B3
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID REFERENCES requests(id) ON DELETE SET NULL, -- Lié après paiement
  amount INTEGER NOT NULL, -- Montant en FCFA
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  payment_method TEXT CHECK (payment_method IN ('wave', 'orange_money', 'mtn_money', 'moov_money')),
  wave_transaction_id TEXT, -- ID de transaction Wave (si fourni)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Contraintes
  CONSTRAINT valid_amount CHECK (amount > 0)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_reference ON invoices(reference);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir leurs propres factures
CREATE POLICY "Users can view own invoices" ON invoices
  FOR SELECT USING (auth.uid() = user_id);

-- Les utilisateurs peuvent créer des factures
CREATE POLICY "Users can create invoices" ON invoices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Les admins peuvent tout voir
CREATE POLICY "Admins can view all invoices" ON invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Les admins peuvent modifier les factures (confirmer paiement)
CREATE POLICY "Admins can update invoices" ON invoices
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Fonction pour expirer automatiquement les factures après 24h
CREATE OR REPLACE FUNCTION expire_old_invoices()
RETURNS void AS $$
BEGIN
  UPDATE invoices
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Commentaires
COMMENT ON TABLE invoices IS 'Factures pour le paiement Wave - workflow manuel';
COMMENT ON COLUMN invoices.reference IS 'Référence unique de facture (IV-YYYYMMDD-XXXX)';
COMMENT ON COLUMN invoices.metadata IS 'Données de la demande sauvegardées pour créer la request après paiement';
