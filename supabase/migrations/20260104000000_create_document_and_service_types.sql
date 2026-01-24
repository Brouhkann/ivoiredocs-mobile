-- Create table for document types
CREATE TABLE IF NOT EXISTS document_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for service types
CREATE TABLE IF NOT EXISTS service_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert existing document types
INSERT INTO document_types (key, label, display_order) VALUES
  ('declaration_naissance', 'Déclaration de naissance', 1),
  ('extrait_acte_naissance', 'Extrait d''acte de naissance', 2),
  ('copie_integrale_naissance', 'Copie intégrale (naissance)', 3),
  ('extrait_acte_mariage', 'Extrait d''acte de mariage', 4),
  ('copie_integrale_mariage', 'Copie intégrale (mariage)', 5),
  ('certificat_celibat', 'Certificat de célibat', 6),
  ('certificat_non_divorce', 'Certificat de non-divorce', 7),
  ('certificat_residence', 'Certificat de résidence', 8)
ON CONFLICT (key) DO NOTHING;

-- Insert existing service types
INSERT INTO service_types (key, label, icon, color, display_order) VALUES
  ('mairie', 'Mairie', 'business', '#2563eb', 1),
  ('sous_prefecture', 'Sous-Préfecture', 'shield-checkmark', '#047857', 2),
  ('justice', 'Justice', 'hammer', '#7c3aed', 3)
ON CONFLICT (key) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_document_types_active ON document_types(is_active);
CREATE INDEX IF NOT EXISTS idx_document_types_order ON document_types(display_order);
CREATE INDEX IF NOT EXISTS idx_service_types_active ON service_types(is_active);
CREATE INDEX IF NOT EXISTS idx_service_types_order ON service_types(display_order);

-- Add RLS policies
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read active types
CREATE POLICY "Anyone can view active document types" ON document_types
  FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view active service types" ON service_types
  FOR SELECT USING (is_active = true);

-- Policy: Only admins can view all types (including inactive)
CREATE POLICY "Admins can view all document types" ON document_types
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can view all service types" ON service_types
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: Only admins can insert, update, delete
CREATE POLICY "Admins can insert document types" ON document_types
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update document types" ON document_types
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete document types" ON document_types
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert service types" ON service_types
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update service types" ON service_types
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete service types" ON service_types
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_document_types_updated_at
  BEFORE UPDATE ON document_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_types_updated_at
  BEFORE UPDATE ON service_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
