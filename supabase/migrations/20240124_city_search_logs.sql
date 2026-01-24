-- Table pour tracker les villes recherchées mais non disponibles
-- Permet à l'admin de voir quelles villes sont demandées

CREATE TABLE IF NOT EXISTS city_search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_term TEXT NOT NULL,
  display_name TEXT, -- Nom avec la casse originale pour l'affichage
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  search_count INTEGER DEFAULT 1,
  first_searched_at TIMESTAMPTZ DEFAULT NOW(),
  last_searched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Index unique sur le terme de recherche normalisé
  CONSTRAINT unique_search_term UNIQUE (search_term)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_city_search_logs_count ON city_search_logs(search_count DESC);
CREATE INDEX IF NOT EXISTS idx_city_search_logs_last_searched ON city_search_logs(last_searched_at DESC);

-- RLS (Row Level Security)
ALTER TABLE city_search_logs ENABLE ROW LEVEL SECURITY;

-- Politique: tout le monde peut insérer/mettre à jour (pour le tracking)
CREATE POLICY "Anyone can insert city search logs" ON city_search_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update city search logs" ON city_search_logs
  FOR UPDATE USING (true);

-- Politique: seuls les admins peuvent lire
CREATE POLICY "Only admins can view city search logs" ON city_search_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Politique: seuls les admins peuvent supprimer
CREATE POLICY "Only admins can delete city search logs" ON city_search_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Commentaire sur la table
COMMENT ON TABLE city_search_logs IS 'Suivi des villes recherchées mais non disponibles dans le service';
