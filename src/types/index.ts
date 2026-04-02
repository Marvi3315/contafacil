// ─── Roles y planes ───────────────────────────────────────────────
export type UserRole = 'owner' | 'admin' | 'contador' | 'empleado' | 'viewer'

export type PlanType = 'free' | 'emprendedor' | 'pyme' | 'agencia'

export type PlanStatus = 'active' | 'past_due' | 'canceled' | 'suspended' | 'trialing'

// ─── Regímenes fiscales mexicanos ─────────────────────────────────
export type RegimenFiscal =
  | 'resico_pf'          // 621 - RESICO Personas Físicas
  | 'actividad_emp'      // 612 - Act. Empresarial y Profesional
  | 'general_pm'         // 601 - General de Ley PM
  | 'pm_fines_no_luc'    // 603 - PM con fines no lucrativos
  | 'arrendamiento'      // 606 - Arrendamiento
  | 'sin_obligaciones'   // 616 - Sin obligaciones fiscales
  | 'incorporacion'      // 621 - Incorporación fiscal (legacy)
  | 'plataformas_tec'    // 625 - Plataformas tecnológicas

// ─── Organizaciones ────────────────────────────────────────────────
export interface Organization {
  id: string
  account_id: string
  name: string
  rfc: string | null
  regimen_fiscal: RegimenFiscal | null
  regimen_code: string | null
  fiscal_address: FiscalAddress | null
  logo_url: string | null
  is_active: boolean
  deleted_at: string | null
  created_at: string
}

export interface FiscalAddress {
  calle: string
  numero_ext: string
  numero_int?: string
  colonia: string
  municipio: string
  estado: string
  cp: string
  pais: string
}

// ─── Cuentas (quien paga) ──────────────────────────────────────────
export interface Account {
  id: string
  owner_user_id: string
  plan: PlanType
  plan_status: PlanStatus
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  trial_ends_at: string | null
  canceled_at: string | null
  created_at: string
}

// ─── Miembros ──────────────────────────────────────────────────────
export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: UserRole
  allowed_category_ids: string[] | null
  invited_by: string | null
  invited_at: string
  accepted_at: string | null
}

// ─── Transacciones ─────────────────────────────────────────────────
export type TransactionType = 'ingreso' | 'egreso'

export type TransactionStatus = 'pendiente' | 'confirmado' | 'cancelado'

export type PaymentMethod =
  | 'efectivo'
  | 'transferencia'
  | 'tarjeta_debito'
  | 'tarjeta_credito'
  | 'cheque'
  | 'otro'

export interface Transaction {
  id: string
  org_id: string
  type: TransactionType
  amount: number
  amount_before_tax: number | null
  iva: number
  isr_retenido: number
  category_id: string | null
  description: string
  notes: string | null
  date: string
  payment_method: PaymentMethod | null
  cfdi_uuid: string | null
  cfdi_url: string | null
  attachment_url: string | null
  status: TransactionStatus
  created_by: string
  created_at: string
  // relaciones opcionales
  category?: Category
}

// ─── Categorías ────────────────────────────────────────────────────
export interface Category {
  id: string
  org_id: string
  name: string
  type: TransactionType
  icon: string
  color: string
  is_default: boolean
}

// ─── Declaraciones fiscales ────────────────────────────────────────
export type DeclarationType =
  | 'iva_mensual'
  | 'isr_mensual'
  | 'isr_anual'
  | 'diot'
  | 'informativa_sueldos'

export type DeclarationStatus = 'pendiente' | 'presentada' | 'pagada' | 'omitida'

export interface TaxDeclaration {
  id: string
  org_id: string
  period: string        // "2026-03"
  type: DeclarationType
  due_date: string
  status: DeclarationStatus
  isr_calculado: number | null
  iva_calculado: number | null
  total_ingresos: number | null
  total_egresos: number | null
  notes: string | null
  created_at: string
}

// ─── Semáforo financiero ────────────────────────────────────────────
export type SemaforoStatus = 'verde' | 'amarillo' | 'rojo'

export interface SemaforoData {
  status: SemaforoStatus
  mensaje: string
  submensaje: string
  margen_neto: number       // porcentaje
  total_ingresos: number
  total_egresos: number
  total_impuestos: number
  total_libre: number
}

// ─── Audit Log ─────────────────────────────────────────────────────
export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'invite'

export interface AuditLog {
  id: string
  org_id: string
  user_id: string
  action: AuditAction
  table_name: string | null
  record_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

// ─── UI helpers ────────────────────────────────────────────────────
export interface SelectOption {
  value: string
  label: string
  icon?: string
  description?: string
}

export interface PaginationParams {
  page: number
  limit: number
  total: number
}

export interface DateRange {
  from: Date
  to: Date
}
