import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatDate, calcularSemaforo } from '@/lib/utils'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'

interface ReportData {
  ingresos: TxRow[]
  egresos: TxRow[]
  totalIngresos: number
  totalEgresos: number
  totalIVA: number
  totalISR: number
  totalLibre: number
  margen: number
  semaforo: 'verde' | 'amarillo' | 'rojo'
}

interface TxRow {
  id: string
  date: string
  description: string
  amount: number
  iva: number
  payment_method: string | null
  categories?: { name: string; icon: string } | null
}

const MESES_OPCIONES = Array.from({ length: 12 }).map((_, i) => {
  const d = subMonths(new Date(), i)
  return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy', { locale: es }) }
})

export default function ReportsPage() {
  const { activeOrg } = useAuthStore()
  const [periodo, setPeriodo] = useState(format(new Date(), 'yyyy-MM'))
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeOrg) loadReport()
  }, [activeOrg, periodo])

  const loadReport = async () => {
    if (!activeOrg) return
    setIsLoading(true)
    try {
      const [year, month] = periodo.split('-')
      const desde = format(startOfMonth(new Date(parseInt(year), parseInt(month) - 1)), 'yyyy-MM-dd')
      const hasta = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), 'yyyy-MM-dd')

      const { data: txs } = await supabase
        .from('transactions')
        .select('*, categories(name, icon)')
        .eq('org_id', activeOrg.id)
        .eq('status', 'confirmado')
        .gte('date', desde)
        .lte('date', hasta)
        .order('date', { ascending: true })

      const ingresos = (txs ?? []).filter(t => t.type === 'ingreso')
      const egresos = (txs ?? []).filter(t => t.type === 'egreso')
      const totalIngresos = ingresos.reduce((s, t) => s + Number(t.amount), 0)
      const totalEgresos = egresos.reduce((s, t) => s + Number(t.amount), 0)
      const totalIVA = (txs ?? []).reduce((s, t) => s + Number(t.iva ?? 0), 0)
      const totalISR = totalIngresos * 0.1
      const { status, margen } = calcularSemaforo(totalIngresos, totalEgresos, totalIVA + totalISR)

      setReportData({
        ingresos,
        egresos,
        totalIngresos,
        totalEgresos,
        totalIVA,
        totalISR,
        totalLibre: totalIngresos - totalEgresos - totalIVA - totalISR,
        margen,
        semaforo: status,
      })
    } catch (err) {
      toast.error('Error al generar el reporte')
    } finally {
      setIsLoading(false)
    }
  }

  const exportarCSV = () => {
    if (!reportData || !activeOrg) return
    setIsExporting(true)
    try {
      const periodoLabel = MESES_OPCIONES.find(m => m.value === periodo)?.label ?? periodo

      const filas = [
        ['ContaFácil — Reporte Mensual'],
        [`Organización: ${activeOrg.name}`],
        [`RFC: ${activeOrg.rfc ?? 'N/A'}`],
        [`Período: ${periodoLabel}`],
        [`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`],
        [],
        ['=== RESUMEN ==='],
        ['Concepto', 'Monto'],
        ['Total Ingresos', reportData.totalIngresos],
        ['Total Egresos', reportData.totalEgresos],
        ['IVA estimado', reportData.totalIVA],
        ['ISR estimado', reportData.totalISR],
        ['Queda libre', reportData.totalLibre],
        ['Margen neto %', `${Math.round(reportData.margen)}%`],
        [],
        ['=== INGRESOS ==='],
        ['Fecha', 'Descripción', 'Categoría', 'Forma de Pago', 'Monto', 'IVA'],
        ...reportData.ingresos.map(t => [
          t.date,
          t.description,
          t.categories?.name ?? 'Sin categoría',
          t.payment_method ?? '',
          t.amount,
          t.iva ?? 0,
        ]),
        ['', '', '', 'TOTAL INGRESOS', reportData.totalIngresos, ''],
        [],
        ['=== EGRESOS ==='],
        ['Fecha', 'Descripción', 'Categoría', 'Forma de Pago', 'Monto', 'IVA'],
        ...reportData.egresos.map(t => [
          t.date,
          t.description,
          t.categories?.name ?? 'Sin categoría',
          t.payment_method ?? '',
          t.amount,
          t.iva ?? 0,
        ]),
        ['', '', '', 'TOTAL EGRESOS', reportData.totalEgresos, ''],
      ]

      const csv = filas.map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n')

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ContaFacil_Reporte_${activeOrg.name}_${periodo}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('¡Reporte CSV exportado! Ábrelo en Excel 📊')
    } catch {
      toast.error('Error al exportar')
    } finally {
      setIsExporting(false)
    }
  }

  const exportarPDF = () => {
    if (!reportData || !activeOrg) return
    setIsExporting(true)
    try {
      const periodoLabel = MESES_OPCIONES.find(m => m.value === periodo)?.label ?? periodo
      const semColors = {
        verde: '#1D9E75',
        amarillo: '#BA7517',
        rojo: '#A32D2D',
      }
      const semColor = semColors[reportData.semaforo]
      const semTexto = { verde: 'Mes saludable', amarillo: 'Mes ajustado', rojo: 'Mes complicado' }[reportData.semaforo]

      const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte ContaFácil — ${periodoLabel}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; font-size: 13px; }
  .header { background: #0D1B2A; color: white; padding: 28px 40px; display: flex; justify-content: space-between; align-items: center; }
  .header-logo { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
  .header-sub { font-size: 11px; opacity: 0.6; margin-top: 2px; }
  .header-right { text-align: right; font-size: 11px; opacity: 0.7; line-height: 1.8; }
  .accent-bar { height: 4px; background: linear-gradient(90deg, #1D9E75, #185FA5); }
  .content { padding: 32px 40px; }
  .periodo { font-size: 18px; font-weight: 700; color: #0D1B2A; margin-bottom: 4px; text-transform: capitalize; }
  .fecha-gen { font-size: 11px; color: #718096; margin-bottom: 28px; }
  .semaforo-box { display: flex; align-items: center; gap: 16px; padding: 16px 20px; border-radius: 10px; background: #f8f9fa; border-left: 4px solid ${semColor}; margin-bottom: 24px; }
  .sem-circle { width: 40px; height: 40px; border-radius: 50%; background: ${semColor}; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 16px; flex-shrink: 0; }
  .sem-titulo { font-size: 15px; font-weight: 700; color: ${semColor}; }
  .sem-margen { font-size: 12px; color: #718096; }
  .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
  .metric-card { padding: 14px 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
  .metric-label { font-size: 10px; color: #718096; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .metric-value { font-size: 17px; font-weight: 700; font-family: 'Courier New', monospace; }
  .section-title { font-size: 12px; font-weight: 700; color: #4a5568; text-transform: uppercase; letter-spacing: 0.08em; margin: 20px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f7fafc; padding: 8px 10px; text-align: left; font-weight: 600; color: #4a5568; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
  td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; color: #2d3748; }
  .amount { font-family: 'Courier New', monospace; font-weight: 600; text-align: right; }
  .ingreso-amount { color: #1D9E75; }
  .egreso-amount { color: #A32D2D; }
  .total-row { background: #f7fafc; font-weight: 700; }
  .footer { margin-top: 40px; padding: 16px 40px; background: #f7fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #718096; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="header-logo">🧾 ContaFácil</div>
    <div class="header-sub">by MMV Digital · Reporte Mensual</div>
  </div>
  <div class="header-right">
    <div><strong>${activeOrg.name}</strong></div>
    <div>RFC: ${activeOrg.rfc ?? 'N/A'}</div>
    <div>${activeOrg.regimen_fiscal ?? ''}</div>
  </div>
</div>
<div class="accent-bar"></div>
<div class="content">
  <div class="periodo">${periodoLabel}</div>
  <div class="fecha-gen">Generado el ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })} · ContaFácil © 2026 MMV Digital</div>

  <div class="semaforo-box">
    <div class="sem-circle">${reportData.semaforo === 'verde' ? '✓' : reportData.semaforo === 'amarillo' ? '!' : '✕'}</div>
    <div>
      <div class="sem-titulo">${semTexto}</div>
      <div class="sem-margen">Margen neto: ${Math.round(reportData.margen)}%</div>
    </div>
  </div>

  <div class="metrics">
    <div class="metric-card">
      <div class="metric-label">Total ingresos</div>
      <div class="metric-value" style="color:#1D9E75">${formatCurrency(reportData.totalIngresos)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Total egresos</div>
      <div class="metric-value" style="color:#A32D2D">${formatCurrency(reportData.totalEgresos)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Impuestos est.</div>
      <div class="metric-value" style="color:#BA7517">${formatCurrency(reportData.totalIVA + reportData.totalISR)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Queda libre</div>
      <div class="metric-value" style="color:#0D1B2A">${formatCurrency(reportData.totalLibre)}</div>
    </div>
  </div>

  <div class="section-title">Ingresos del período (${reportData.ingresos.length} movimientos)</div>
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Descripción</th>
        <th>Categoría</th>
        <th>Forma de pago</th>
        <th style="text-align:right">Monto</th>
        <th style="text-align:right">IVA</th>
      </tr>
    </thead>
    <tbody>
      ${reportData.ingresos.map(t => `
        <tr>
          <td>${formatDate(t.date, 'dd/MM/yyyy')}</td>
          <td>${t.description}</td>
          <td>${t.categories?.name ?? '—'}</td>
          <td>${t.payment_method ?? '—'}</td>
          <td class="amount ingreso-amount">+${formatCurrency(t.amount)}</td>
          <td class="amount" style="color:#718096">${t.iva > 0 ? formatCurrency(t.iva) : '—'}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="4">TOTAL INGRESOS</td>
        <td class="amount ingreso-amount">+${formatCurrency(reportData.totalIngresos)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">Egresos del período (${reportData.egresos.length} movimientos)</div>
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Descripción</th>
        <th>Categoría</th>
        <th>Forma de pago</th>
        <th style="text-align:right">Monto</th>
        <th style="text-align:right">IVA</th>
      </tr>
    </thead>
    <tbody>
      ${reportData.egresos.map(t => `
        <tr>
          <td>${formatDate(t.date, 'dd/MM/yyyy')}</td>
          <td>${t.description}</td>
          <td>${t.categories?.name ?? '—'}</td>
          <td>${t.payment_method ?? '—'}</td>
          <td class="amount egreso-amount">-${formatCurrency(t.amount)}</td>
          <td class="amount" style="color:#718096">${t.iva > 0 ? formatCurrency(t.iva) : '—'}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="4">TOTAL EGRESOS</td>
        <td class="amount egreso-amount">-${formatCurrency(reportData.totalEgresos)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">Resumen fiscal estimado</div>
  <table>
    <tbody>
      <tr><td>IVA a pagar al SAT</td><td class="amount" style="color:#BA7517">${formatCurrency(reportData.totalIVA)}</td></tr>
      <tr><td>ISR provisional estimado</td><td class="amount" style="color:#BA7517">${formatCurrency(reportData.totalISR)}</td></tr>
      <tr class="total-row"><td>Total a apartar para el SAT</td><td class="amount egreso-amount">${formatCurrency(reportData.totalIVA + reportData.totalISR)}</td></tr>
    </tbody>
  </table>
</div>
<div class="footer">
  <span>ContaFácil © 2026 — MMV Digital · Moisés Martínez Virgen · Guadalajara, Jalisco, México</span>
  <span>Este reporte es informativo. Consulta a tu contador para declaraciones oficiales.</span>
</div>
</body>
</html>`

      const ventana = window.open('', '_blank')
      if (!ventana) { toast.error('Permite las ventanas emergentes para exportar el PDF'); return }
      ventana.document.write(html)
      ventana.document.close()
      ventana.onload = () => {
        ventana.focus()
        ventana.print()
      }
      toast.success('¡Reporte PDF listo para imprimir o guardar!')
    } catch {
      toast.error('Error al generar el PDF')
    } finally {
      setIsExporting(false)
    }
  }

  const semConfig = {
    verde:    { color: '#1D9E75', bg: '#EAF3DE', icono: '✓', texto: 'Mes saludable' },
    amarillo: { color: '#BA7517', bg: '#FAEEDA', icono: '!', texto: 'Mes ajustado' },
    rojo:     { color: '#A32D2D', bg: '#FCEBEB', icono: '✕', texto: 'Mes complicado' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--cf-navy)', margin: '0 0 4px' }}>
            📊 Reportes
          </h1>
          <p style={{ fontSize: 13, color: 'var(--cf-text-tertiary)', margin: 0 }}>
            Genera y exporta tu reporte mensual para tu contador
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select
            value={periodo}
            onChange={e => setPeriodo(e.target.value)}
            style={{
              padding: '9px 12px', borderRadius: 8, fontSize: 13,
              border: '1px solid var(--cf-border)', background: 'var(--cf-bg-card)',
              color: 'var(--cf-text-primary)', fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            {MESES_OPCIONES.map(m => (
              <option key={m.value} value={m.value}>
                {m.label.charAt(0).toUpperCase() + m.label.slice(1)}
              </option>
            ))}
          </select>

          <button
            onClick={exportarCSV}
            disabled={isExporting || !reportData}
            style={{
              padding: '9px 18px', borderRadius: 8, border: '1px solid var(--cf-border)',
              background: 'var(--cf-bg-card)', color: 'var(--cf-text-primary)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            📥 Excel / CSV
          </button>

          <button
            onClick={exportarPDF}
            disabled={isExporting || !reportData}
            style={{
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: 'var(--cf-navy)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            🖨️ Exportar PDF
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
        </div>
      ) : !reportData ? null : (
        <>
          {/* ── Semáforo del reporte ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="cf-card"
            style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20 }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: semConfig[reportData.semaforo].color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 20, fontWeight: 700, flexShrink: 0,
            }}>
              {semConfig[reportData.semaforo].icono}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: semConfig[reportData.semaforo].color }}>
                {semConfig[reportData.semaforo].texto}
              </div>
              <div style={{ fontSize: 13, color: 'var(--cf-text-tertiary)', marginTop: 2 }}>
                {MESES_OPCIONES.find(m => m.value === periodo)?.label.charAt(0).toUpperCase()}{MESES_OPCIONES.find(m => m.value === periodo)?.label.slice(1)} · Margen neto: {Math.round(reportData.margen)}%
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--cf-text-tertiary)', textAlign: 'right' }}>
              <div>{reportData.ingresos.length + reportData.egresos.length} movimientos</div>
              <div style={{ fontSize: 11 }}>en el período</div>
            </div>
          </motion.div>

          {/* ── 4 métricas ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {[
              { label: 'Total ingresos', value: reportData.totalIngresos, color: 'var(--cf-green)' },
              { label: 'Total egresos', value: reportData.totalEgresos, color: 'var(--cf-red)' },
              { label: 'Impuestos est.', value: reportData.totalIVA + reportData.totalISR, color: 'var(--cf-amber)' },
              { label: 'Queda libre', value: reportData.totalLibre, color: 'var(--cf-navy)' },
            ].map((c, i) => (
              <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="cf-card" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 11, color: 'var(--cf-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: c.color, fontFamily: 'var(--font-mono)' }}>{formatCurrency(c.value)}</div>
              </motion.div>
            ))}
          </div>

          {/* ── Tabla ingresos ── */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="cf-card" style={{ padding: '20px 24px', overflowX: 'auto' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-green)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ↑ Ingresos — {reportData.ingresos.length} movimientos
            </div>
            {reportData.ingresos.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--cf-text-tertiary)', textAlign: 'center', padding: '20px 0' }}>Sin ingresos en este período</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--cf-border)' }}>
                    {['Fecha', 'Descripción', 'Categoría', 'Forma de pago', 'Monto', 'IVA'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Monto' || h === 'IVA' ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: 'var(--cf-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.ingresos.map((tx, i) => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--cf-border)', background: i % 2 === 0 ? 'transparent' : 'var(--cf-bg-subtle)' }}>
                      <td style={{ padding: '9px 10px', color: 'var(--cf-text-tertiary)', fontSize: 12 }}>{formatDate(tx.date, 'dd/MM/yyyy')}</td>
                      <td style={{ padding: '9px 10px', color: 'var(--cf-text-primary)', fontWeight: 500 }}>{tx.description}</td>
                      <td style={{ padding: '9px 10px', color: 'var(--cf-text-secondary)', fontSize: 12 }}>{tx.categories?.icon} {tx.categories?.name ?? '—'}</td>
                      <td style={{ padding: '9px 10px', color: 'var(--cf-text-tertiary)', fontSize: 12 }}>{tx.payment_method ?? '—'}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--cf-green)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>+{formatCurrency(tx.amount)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--cf-text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{tx.iva > 0 ? formatCurrency(tx.iva) : '—'}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--cf-border)', background: 'var(--cf-bg-subtle)' }}>
                    <td colSpan={4} style={{ padding: '10px', fontWeight: 700, color: 'var(--cf-text-primary)', fontSize: 13 }}>TOTAL INGRESOS</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--cf-green)', fontFamily: 'var(--font-mono)', fontSize: 15 }}>+{formatCurrency(reportData.totalIngresos)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            )}
          </motion.div>

          {/* ── Tabla egresos ── */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="cf-card" style={{ padding: '20px 24px', overflowX: 'auto' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-red)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ↓ Egresos — {reportData.egresos.length} movimientos
            </div>
            {reportData.egresos.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--cf-text-tertiary)', textAlign: 'center', padding: '20px 0' }}>Sin egresos en este período</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--cf-border)' }}>
                    {['Fecha', 'Descripción', 'Categoría', 'Forma de pago', 'Monto', 'IVA'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Monto' || h === 'IVA' ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: 'var(--cf-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.egresos.map((tx, i) => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--cf-border)', background: i % 2 === 0 ? 'transparent' : 'var(--cf-bg-subtle)' }}>
                      <td style={{ padding: '9px 10px', color: 'var(--cf-text-tertiary)', fontSize: 12 }}>{formatDate(tx.date, 'dd/MM/yyyy')}</td>
                      <td style={{ padding: '9px 10px', color: 'var(--cf-text-primary)', fontWeight: 500 }}>{tx.description}</td>
                      <td style={{ padding: '9px 10px', color: 'var(--cf-text-secondary)', fontSize: 12 }}>{tx.categories?.icon} {tx.categories?.name ?? '—'}</td>
                      <td style={{ padding: '9px 10px', color: 'var(--cf-text-tertiary)', fontSize: 12 }}>{tx.payment_method ?? '—'}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--cf-red)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>-{formatCurrency(tx.amount)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--cf-text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{tx.iva > 0 ? formatCurrency(tx.iva) : '—'}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--cf-border)', background: 'var(--cf-bg-subtle)' }}>
                    <td colSpan={4} style={{ padding: '10px', fontWeight: 700, color: 'var(--cf-text-primary)', fontSize: 13 }}>TOTAL EGRESOS</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--cf-red)', fontFamily: 'var(--font-mono)', fontSize: 15 }}>-{formatCurrency(reportData.totalEgresos)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            )}
          </motion.div>

          {/* ── Resumen fiscal ── */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="cf-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-text-secondary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🏛️ Resumen fiscal estimado
            </div>
            {[
              { label: 'IVA a pagar al SAT', value: reportData.totalIVA, color: 'var(--cf-amber)' },
              { label: 'ISR provisional estimado', value: reportData.totalISR, color: 'var(--cf-amber)' },
              { label: 'Total a apartar para el SAT', value: reportData.totalIVA + reportData.totalISR, color: 'var(--cf-red)', bold: true },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--cf-border)' }}>
                <span style={{ fontSize: 13, fontWeight: item.bold ? 700 : 400, color: item.bold ? 'var(--cf-text-primary)' : 'var(--cf-text-secondary)' }}>{item.label}</span>
                <span style={{ fontSize: item.bold ? 17 : 14, fontWeight: 700, color: item.color, fontFamily: 'var(--font-mono)' }}>{formatCurrency(item.value)}</span>
              </div>
            ))}
            <p style={{ fontSize: 11, color: 'var(--cf-text-tertiary)', marginTop: 12, lineHeight: 1.6 }}>
              * Estos son cálculos estimados. Consulta con tu contador para las declaraciones oficiales ante el SAT.
            </p>
          </motion.div>
        </>
      )}
    </div>
  )
}
