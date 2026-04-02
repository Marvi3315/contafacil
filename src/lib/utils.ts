import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

// ─── Tailwind class merger ─────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Formateo de moneda MXN ────────────────────────────────────────
export function formatCurrency(
  amount: number,
  options?: { showSign?: boolean; compact?: boolean }
): string {
  const { showSign = false, compact = false } = options ?? {}

  if (compact && Math.abs(amount) >= 1000) {
    const divided = amount / 1000
    return `$${divided.toFixed(1)}k`
  }

  const formatted = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))

  if (showSign && amount > 0) return `+${formatted}`
  if (amount < 0) return `-${formatted}`
  return formatted
}

// ─── Formateo de fechas en español ────────────────────────────────
export function formatDate(date: string | Date, pattern = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, pattern, { locale: es })
}

export function formatDateLong(date: string | Date): string {
  return formatDate(date, "d 'de' MMMM 'de' yyyy")
}

export function formatPeriod(period: string): string {
  // "2026-03" → "Marzo 2026"
  const [year, month] = period.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  return format(date, "MMMM yyyy", { locale: es })
}

// ─── Cálculos fiscales básicos ────────────────────────────────────
export function calcularIVA(monto: number, tasa = 0.16): number {
  return Math.round(monto * tasa * 100) / 100
}

export function calcularISR_RESICO(ingresosMensuales: number): number {
  // Tabla RESICO 2026 (tasas aproximadas)
  if (ingresosMensuales <= 25000) return ingresosMensuales * 0.01
  if (ingresosMensuales <= 50000) return ingresosMensuales * 0.011
  if (ingresosMensuales <= 83333) return ingresosMensuales * 0.013
  if (ingresosMensuales <= 208333) return ingresosMensuales * 0.015
  return ingresosMensuales * 0.02
}

export function calcularSemaforo(
  ingresos: number,
  egresos: number,
  impuestos: number
): { status: 'verde' | 'amarillo' | 'rojo'; margen: number } {
  const libre = ingresos - egresos - impuestos
  const margen = ingresos > 0 ? (libre / ingresos) * 100 : 0

  if (margen >= 40) return { status: 'verde', margen }
  if (margen >= 15) return { status: 'amarillo', margen }
  return { status: 'rojo', margen }
}

// ─── Validación de RFC mexicano ────────────────────────────────────
export function validarRFC(rfc: string): boolean {
  const rfcPF = /^[A-Z&Ñ]{4}\d{6}[A-Z0-9]{3}$/
  const rfcPM = /^[A-Z&Ñ]{3}\d{6}[A-Z0-9]{3}$/
  const rfcClean = rfc.toUpperCase().trim()
  return rfcPF.test(rfcClean) || rfcPM.test(rfcClean)
}

// ─── Formateo de RFC con guiones ──────────────────────────────────
export function formatRFC(rfc: string): string {
  const clean = rfc.toUpperCase().replace(/[^A-Z0-9&Ñ]/g, '')
  if (clean.length === 13) {
    return `${clean.slice(0,4)}-${clean.slice(4,10)}-${clean.slice(10)}`
  }
  if (clean.length === 12) {
    return `${clean.slice(0,3)}-${clean.slice(3,9)}-${clean.slice(9)}`
  }
  return clean
}

// ─── Iniciales para avatar ─────────────────────────────────────────
export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

// ─── Truncar texto ─────────────────────────────────────────────────
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}

// ─── Debounce ──────────────────────────────────────────────────────
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), delay)
  }
}

// ─── Sleep ─────────────────────────────────────────────────────────
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
