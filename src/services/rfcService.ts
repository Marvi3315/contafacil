// ═══════════════════════════════════════════════════════════
//  rfcService.ts — Consulta RFC al SAT
//  ContaFácil / DeclaraYa — MMV Digital © 2026
// ═══════════════════════════════════════════════════════════

export interface RFCData {
  rfc: string
  razon_social: string
  regimen_fiscal: string
  regimen_code: string
  tipo_persona: 'fisica' | 'moral'
  codigo_postal: string
  sat_status: 'activo' | 'cancelado' | 'suspendido' | 'desconocido'
}

export type RFCLookupStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'error'

// ── Validación de formato RFC ────────────────────────────────
export function validarFormatoRFC(rfc: string): boolean {
  const rfcFisica = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/
  const rfcMoral  = /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/
  return rfcFisica.test(rfc) || rfcMoral.test(rfc)
}

export function getTipoPersona(rfc: string): 'fisica' | 'moral' {
  return rfc.length === 13 ? 'fisica' : 'moral'
}

// ── Normalizar RFC ───────────────────────────────────────────
export function normalizarRFC(rfc: string): string {
  return rfc.toUpperCase().replace(/[^A-Z0-9Ñ&]/g, '')
}

// ── Cache local 24hrs ────────────────────────────────────────
const CACHE_KEY = 'rfc_cache'
const CACHE_TTL = 24 * 60 * 60 * 1000

function getCache(rfc: string): RFCData | null {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}_${rfc}`)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(`${CACHE_KEY}_${rfc}`)
      return null
    }
    return data
  } catch { return null }
}

function setCache(rfc: string, data: RFCData) {
  try {
    localStorage.setItem(`${CACHE_KEY}_${rfc}`, JSON.stringify({ data, ts: Date.now() }))
  } catch { /* ignore */ }
}

// ── Mapeo de claves de régimen SAT ───────────────────────────
const REGIMEN_MAP: Record<string, { label: string; code: string }> = {
  '601': { label: 'General de Ley Personas Morales', code: '601' },
  '603': { label: 'Personas Morales con Fines no Lucrativos', code: '603' },
  '605': { label: 'Sueldos y Salarios', code: '605' },
  '606': { label: 'Arrendamiento', code: '606' },
  '608': { label: 'Demás ingresos', code: '608' },
  '609': { label: 'Consolidación', code: '609' },
  '610': { label: 'Residentes en el Extranjero', code: '610' },
  '611': { label: 'Ingresos por Dividendos', code: '611' },
  '612': { label: 'Personas Físicas con Actividades Empresariales', code: '612' },
  '614': { label: 'Ingresos por intereses', code: '614' },
  '616': { label: 'Sin obligaciones fiscales', code: '616' },
  '620': { label: 'Sociedades Cooperativas de Producción', code: '620' },
  '621': { label: 'RESICO - Régimen Simplificado de Confianza', code: '621' },
  '622': { label: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras', code: '622' },
  '623': { label: 'Opcional para Grupos de Sociedades', code: '623' },
  '624': { label: 'Coordinados', code: '624' },
  '625': { label: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas', code: '625' },
  '626': { label: 'Régimen Simplificado de Confianza - RESICO', code: '626' },
}

// ── Consulta principal con fallback ─────────────────────────
export async function lookupRFC(rfc: string): Promise<RFCData | null> {
  const rfcClean = normalizarRFC(rfc)

  // 1. Revisar cache primero
  const cached = getCache(rfcClean)
  if (cached) return cached

  // 2. Intentar api.fiscal.lat (sin key, gratis)
  try {
    const res = await fetch(
      `https://api.fiscal.lat/v4/taxpayer/${rfcClean}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      }
    )
    if (res.ok) {
      const json = await res.json()
      if (json && json.rfc) {
        const regimenCode = json.tax_regime_code || json.regimen_code || ''
        const regimenInfo = REGIMEN_MAP[regimenCode] || { label: json.tax_regime || '', code: regimenCode }
        const data: RFCData = {
          rfc:            json.rfc,
          razon_social:   json.name || json.razon_social || '',
          regimen_fiscal: regimenInfo.label,
          regimen_code:   regimenInfo.code,
          tipo_persona:   getTipoPersona(rfcClean),
          codigo_postal:  json.postal_code || json.codigo_postal || '',
          sat_status:     (json.status || 'activo').toLowerCase() as RFCData['sat_status'],
        }
        setCache(rfcClean, data)
        return data
      }
    }
  } catch { /* silently fail, try next */ }

  // 3. Fallback: construir datos básicos desde el RFC
  // (cuando las APIs no responden, al menos damos tipo de persona)
  const fallback: RFCData = {
    rfc:            rfcClean,
    razon_social:   '',
    regimen_fiscal: '',
    regimen_code:   '',
    tipo_persona:   getTipoPersona(rfcClean),
    codigo_postal:  '',
    sat_status:     'desconocido',
  }

  return fallback
}
