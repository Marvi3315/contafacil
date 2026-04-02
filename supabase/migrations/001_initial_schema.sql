-- ================================================================
-- CONTAFÁCIL — Schema PostgreSQL para Supabase
-- MMV Digital © 2026 — Moisés Martínez Virgen
-- Migración: 001_initial_schema.sql
-- ================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ----------------------------------------------------------------
-- CUENTAS (quien paga la suscripción)
-- ----------------------------------------------------------------
CREATE TABLE accounts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                    TEXT NOT NULL DEFAULT 'free'
                          CHECK (plan IN ('free','emprendedor','pyme','agencia')),
  plan_status             TEXT NOT NULL DEFAULT 'active'
                          CHECK (plan_status IN ('active','past_due','canceled','suspended','trialing')),
  stripe_customer_id      TEXT UNIQUE,
  stripe_subscription_id  TEXT UNIQUE,
  trial_ends_at           TIMESTAMPTZ,
  canceled_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- ORGANIZACIONES (empresa o persona física con RFC)
-- ----------------------------------------------------------------
CREATE TABLE organizations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  rfc               TEXT,
  regimen_fiscal    TEXT,
  regimen_code      TEXT,
  fiscal_address    JSONB,
  logo_url          TEXT,
  csd_cert_url      TEXT,
  csd_key_url       TEXT,
  csd_password_hash TEXT,
  is_active         BOOLEAN DEFAULT true,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- MIEMBROS (usuario ↔ organización con rol)
-- ----------------------------------------------------------------
CREATE TABLE org_members (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role                TEXT NOT NULL
                      CHECK (role IN ('owner','admin','contador','empleado','viewer')),
  allowed_category_ids UUID[] DEFAULT NULL,
  invited_by          UUID REFERENCES auth.users(id),
  invited_at          TIMESTAMPTZ DEFAULT now(),
  accepted_at         TIMESTAMPTZ,
  invite_token        TEXT UNIQUE,
  invite_expires_at   TIMESTAMPTZ,
  UNIQUE(org_id, user_id)
);

-- ----------------------------------------------------------------
-- CATEGORÍAS DE TRANSACCIONES
-- ----------------------------------------------------------------
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('ingreso','egreso')),
  icon        TEXT NOT NULL DEFAULT '💰',
  color       TEXT NOT NULL DEFAULT '#1D9E75',
  is_default  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- TRANSACCIONES (corazón del sistema)
-- ----------------------------------------------------------------
CREATE TABLE transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('ingreso','egreso')),
  amount            NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  amount_before_tax NUMERIC(14,2),
  iva               NUMERIC(14,2) DEFAULT 0,
  isr_retenido      NUMERIC(14,2) DEFAULT 0,
  category_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
  description       TEXT NOT NULL,
  notes             TEXT,
  date              DATE NOT NULL,
  payment_method    TEXT CHECK (payment_method IN (
                      'efectivo','transferencia','tarjeta_debito',
                      'tarjeta_credito','cheque','otro'
                    )),
  cfdi_uuid         TEXT,
  cfdi_url          TEXT,
  attachment_url    TEXT,
  status            TEXT DEFAULT 'confirmado'
                    CHECK (status IN ('pendiente','confirmado','cancelado')),
  created_by        UUID NOT NULL REFERENCES auth.users(id),
  updated_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_transactions_org_date ON transactions(org_id, date DESC);
CREATE INDEX idx_transactions_org_type ON transactions(org_id, type);
CREATE INDEX idx_transactions_org_status ON transactions(org_id, status);

-- ----------------------------------------------------------------
-- DECLARACIONES FISCALES
-- ----------------------------------------------------------------
CREATE TABLE tax_declarations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period           TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN (
                     'iva_mensual','isr_mensual','isr_anual',
                     'diot','informativa_sueldos'
                   )),
  due_date         DATE,
  status           TEXT DEFAULT 'pendiente'
                   CHECK (status IN ('pendiente','presentada','pagada','omitida')),
  isr_calculado    NUMERIC(14,2),
  iva_calculado    NUMERIC(14,2),
  total_ingresos   NUMERIC(14,2),
  total_egresos    NUMERIC(14,2),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tax_declarations_org_period ON tax_declarations(org_id, period DESC);

-- ----------------------------------------------------------------
-- CUENTAS BANCARIAS
-- ----------------------------------------------------------------
CREATE TABLE bank_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_name       TEXT NOT NULL,
  account_alias   TEXT,
  last_4          TEXT,
  clabe_encrypted TEXT,
  currency        TEXT DEFAULT 'MXN',
  current_balance NUMERIC(14,2) DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- RECORDATORIOS
-- ----------------------------------------------------------------
CREATE TABLE reminders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT,
  type       TEXT CHECK (type IN ('declaracion','pago','custom','imss')),
  due_date   DATE,
  is_read    BOOLEAN DEFAULT false,
  sent_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- AUDIT LOG (inmutable — solo INSERT permitido)
-- ----------------------------------------------------------------
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES organizations(id),
  user_id     UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL
              CHECK (action IN ('create','update','delete','login','logout','export','invite')),
  table_name  TEXT,
  record_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Prevenir UPDATE y DELETE en audit_log
CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;

-- ----------------------------------------------------------------
-- FUNCIÓN: actualizar updated_at automáticamente
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------
ALTER TABLE accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log       ENABLE ROW LEVEL SECURITY;

-- Helper: ¿el usuario es miembro activo de la org?
CREATE OR REPLACE FUNCTION is_org_member(p_org_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id
      AND user_id = p_user_id
      AND accepted_at IS NOT NULL
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: ¿qué rol tiene el usuario en la org?
CREATE OR REPLACE FUNCTION get_org_role(p_org_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
  SELECT role FROM org_members
  WHERE org_id = p_org_id AND user_id = p_user_id AND accepted_at IS NOT NULL
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Policies: Organizations
CREATE POLICY "miembros_ven_su_org" ON organizations
  FOR SELECT USING (is_org_member(id));

CREATE POLICY "owner_admin_actualizan_org" ON organizations
  FOR UPDATE USING (get_org_role(id) IN ('owner','admin'));

-- Policies: Transactions
CREATE POLICY "miembros_ven_transacciones" ON transactions
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "pueden_crear_transacciones" ON transactions
  FOR INSERT WITH CHECK (
    get_org_role(org_id) IN ('owner','admin','empleado')
  );

CREATE POLICY "owner_admin_contador_actualizan" ON transactions
  FOR UPDATE USING (
    get_org_role(org_id) IN ('owner','admin','contador')
  );

CREATE POLICY "solo_owner_admin_eliminan" ON transactions
  FOR DELETE USING (
    get_org_role(org_id) IN ('owner','admin')
  );

-- Policies: Categories
CREATE POLICY "miembros_ven_categorias" ON categories
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "owner_admin_gestionan_categorias" ON categories
  FOR ALL USING (get_org_role(org_id) IN ('owner','admin'));

-- Policies: Tax declarations
CREATE POLICY "miembros_ven_declaraciones" ON tax_declarations
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "owner_admin_contador_gestionan_decl" ON tax_declarations
  FOR ALL USING (get_org_role(org_id) IN ('owner','admin','contador'));

-- Policies: Reminders
CREATE POLICY "miembros_ven_recordatorios" ON reminders
  FOR SELECT USING (is_org_member(org_id));

-- Policies: Audit log (solo lectura para owner/admin)
CREATE POLICY "owner_admin_ven_audit" ON audit_log
  FOR SELECT USING (
    org_id IS NOT NULL AND get_org_role(org_id) IN ('owner','admin')
  );

CREATE POLICY "sistema_inserta_audit" ON audit_log
  FOR INSERT WITH CHECK (true);

-- ----------------------------------------------------------------
-- SEED: Categorías por defecto para nuevas organizaciones
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_default_categories(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO categories (org_id, name, type, icon, color, is_default) VALUES
    (p_org_id, 'Ventas / Servicios',       'ingreso', '💼', '#1D9E75', true),
    (p_org_id, 'Cobro de facturas',         'ingreso', '📄', '#185FA5', true),
    (p_org_id, 'Otros ingresos',            'ingreso', '💰', '#1D9E75', true),
    (p_org_id, 'Renta / Local',             'egreso',  '🏠', '#A32D2D', true),
    (p_org_id, 'Nómina / Sueldos',          'egreso',  '👥', '#BA7517', true),
    (p_org_id, 'Compras / Inventario',      'egreso',  '📦', '#A32D2D', true),
    (p_org_id, 'Servicios (luz, agua, tel)','egreso',  '⚡', '#BA7517', true),
    (p_org_id, 'Herramientas / Software',   'egreso',  '🛠️', '#185FA5', true),
    (p_org_id, 'Transporte / Gasolina',     'egreso',  '🚗', '#BA7517', true),
    (p_org_id, 'Impuestos pagados',         'egreso',  '🏛️', '#A32D2D', true),
    (p_org_id, 'Otros gastos',              'egreso',  '📋', '#4A5568', true);
END;
$$ LANGUAGE plpgsql;
