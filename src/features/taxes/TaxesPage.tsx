import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatDate, calcularISR_RESICO, calcularIVA } from '@/lib/utils'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'

interface DeclaracionLocal {
  id: string
  type: string
  period: string
  due_date: string
  status: string
  isr_calculado: number | null
  iva_calculado: number | null
  total_ingresos: number | null
  total_egresos: number | null
}

interface ResumenMes {
  period: string
  ingresos: number
  egresos: number
  iva_cobrado: number
  iva_pagado: number
  isr_estimado: number
  iva_a_pagar: number
  total_a_pagar: number
}

const TIPO_LABELS: Record<string, string> = {
  iva_mensual: 'IVA Mensual',
  isr_mensual: 'ISR Mensual (Provisional)',
  isr_anual: 'ISR Anual',
  diot: 'DIOT',
  informativa_sueldos: 'Informativa de Sueldos',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pendiente: { label: 'Pendiente', color: '#854F0B', bg: '#FAEEDA' },
  presentada: { label: 'Presentada', color: '#185FA5', bg: '#E6F1FB' },
  pagada:     { label: 'Pagada', color: '#27500A', bg: '#EAF3DE' },
  omitida:    { label: 'Omitida', color: '#791F1F', bg: '#FCEBEB' },
}

export default function TaxesPage() {
  const { activeOrg } = useAuthStore()
  const [declaraciones, setDeclaraciones] = useState<DeclaracionLocal[]>([])
  const [resumen, setResumen] = useState<ResumenMes | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(format(new Date(), 'yyyy-MM'))
  const [showNuevaDec, setShowNuevaDec] = useState(false)
  const [isCalculando, setIsCalculando] = useState(false)

  useEffect(() => {
    if (!activeOrg) return
    loadData()
  }, [activeOrg, periodoSeleccionado])

  const loadData = async () => {
    if (!activeOrg) return
    setIsLoading(true)
    try {
      // Cargar declaraciones
      const { data: decls } = await supabase
        .from('tax_declarations')
        .select('*')
        .eq('org_id', activeOrg.id)
        .order('due_date', { ascending: false })

      setDeclaraciones(decls ?? [])

      // Calcular resumen del período seleccionado
      await calcularResumen()
    } catch (err) {
      console.error('Error cargando impuestos:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const calcularResumen = async () => {
    if (!activeOrg) return
    const [year, month] = periodoSeleccionado.split('-')
    const desde = format(startOfMonth(new Date(parseInt(year), parseInt(month) - 1)), 'yyyy-MM-dd')
    const hasta = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), 'yyyy-MM-dd')

    const { data: txs } = await supabase
      .from('transactions')
      .select('type, amount, iva')
      .eq('org_id', activeOrg.id)
      .eq('status', 'confirmado')
      .gte('date', desde)
      .lte('date', hasta)

    if (!txs) return

    const ingresos = txs.filter(t => t.type === 'ingreso').reduce((s, t) => s + Number(t.amount), 0)
    const egresos = txs.filter(t => t.type === 'egreso').reduce((s, t) => s + Number(t.amount), 0)
    const iva_cobrado = txs.filter(t => t.type === 'ingreso').reduce((s, t) => s + Number(t.iva ?? 0), 0)
    const iva_pagado = txs.filter(t => t.type === 'egreso').reduce((s, t) => s + Number(t.iva ?? 0), 0)
    const iva_a_pagar = Math.max(0, iva_cobrado - iva_pagado)

    // ISR según régimen
    let isr_estimado = 0
    const regimen = activeOrg.regimen_code
    if (regimen === '621') {
      isr_estimado = calcularISR_RESICO(ingresos)
    } else if (regimen === '612') {
      const utilidad = ingresos - egresos
      isr_estimado = utilidad > 0 ? utilidad * 0.1 : 0
    } else if (regimen === '601') {
      const utilidad = ingresos - egresos
      isr_estimado = utilidad > 0 ? utilidad * 0.3 : 0
    } else {
      isr_estimado = calcularISR_RESICO(ingresos)
    }

    setResumen({
      period: periodoSeleccionado,
      ingresos,
      egresos,
      iva_cobrado,
      iva_pagado,
      isr_estimado,
      iva_a_pagar,
      total_a_pagar: isr_estimado + iva_a_pagar,
    })
  }

  const generarDeclaracionMensual = async () => {
    if (!activeOrg || !resumen) return
    setIsCalculando(true)
    try {
      const [year, month] = periodoSeleccionado.split('-')
      const diaVencimiento = 17
      const mesVencimiento = parseInt(month) === 12 ? 1 : parseInt(month) + 1
      const anioVencimiento = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year)
      const due_date = `${anioVencimiento}-${String(mesVencimiento).padStart(2, '0')}-${diaVencimiento}`

      // IVA mensual
      const { error: e1 } = await supabase.from('tax_declarations').upsert({
        org_id: activeOrg.id,
        period: periodoSeleccionado,
        type: 'iva_mensual',
        due_date,
        status: 'pendiente',
        iva_calculado: resumen.iva_a_pagar,
        total_ingresos: resumen.ingresos,
        total_egresos: resumen.egresos,
      }, { onConflict: 'org_id,period,type' })

      // ISR mensual provisional
      const { error: e2 } = await supabase.from('tax_declarations').upsert({
        org_id: activeOrg.id,
        period: periodoSeleccionado,
        type: 'isr_mensual',
        due_date,
        status: 'pendiente',
        isr_calculado: resumen.isr_estimado,
        total_ingresos: resumen.ingresos,
        total_egresos: resumen.egresos,
      }, { onConflict: 'org_id,period,type' })

      if (e1 || e2) throw new Error('Error generando declaraciones')

      toast.success('¡Declaraciones generadas correctamente!')
      loadData()
    } catch (err) {
      toast.error('Error al generar declaraciones')
    } finally {
      setIsCalculando(false)
    }
  }

  const actualizarStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('tax_declarations')
        .update({ status })
        .eq('id', id)
      if (error) throw error
      toast.success('Estado actualizado')
      loadData()
    } catch {
      toast.error('Error al actualizar')
    }
  }

  const diasParaVencer = (due_date: string) => {
    return Math.ceil((new Date(due_date).getTime() - Date.now()) / 86400000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--cf-navy)', margin: '0 0 4px' }}>
            🏛️ ¿Qué le debo al SAT?
          </h1>
          <p style={{ fontSize: 13, color: 'var(--cf-text-tertiary)', margin: 0 }}>
            Cálculo automático de impuestos según tu régimen fiscal
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select
            value={periodoSeleccionado}
            onChange={e => setPeriodoSeleccionado(e.target.value)}
            style={{
              padding: '9px 12px', borderRadius: 8, fontSize: 13,
              border: '1px solid var(--cf-border)', background: 'var(--cf-bg-card)',
              color: 'var(--cf-text-primary)', fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            {Array.from({ length: 12 }).map((_, i) => {
              const d = subMonths(new Date(), i)
              const val = format(d, 'yyyy-MM')
              const label = format(d, 'MMMM yyyy', { locale: es })
              return <option key={val} value={val}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>
            })}
          </select>
          <button
            onClick={generarDeclaracionMensual}
            disabled={isCalculando || !resumen}
            style={{
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: 'var(--cf-navy)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-sans)', opacity: isCalculando ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {isCalculando ? '⏳ Calculando...' : '⚡ Generar declaraciones'}
          </button>
        </div>
      </div>

      {/* ── Régimen fiscal ── */}
      {activeOrg?.regimen_fiscal && (
        <div style={{
          padding: '12px 18px', borderRadius: 10,
          background: '#E6F1FB', border: '1px solid #85B7EB',
          fontSize: 13, color: '#0C447C',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>📋</span>
          <span>
            Tu régimen fiscal: <strong>{activeOrg.regimen_fiscal}</strong>
            {activeOrg.regimen_code && ` (Clave ${activeOrg.regimen_code})`}
            {' '}— Los cálculos se realizan automáticamente según este régimen.
          </span>
        </div>
      )}

      {/* ── Resumen del período ── */}
      {resumen && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}
        >
          {[
            { label: 'Ingresos del período', value: resumen.ingresos, color: 'var(--cf-green)', icon: '↑' },
            { label: 'IVA cobrado a clientes', value: resumen.iva_cobrado, color: 'var(--cf-blue)', icon: '📤' },
            { label: 'IVA pagado en gastos', value: resumen.iva_pagado, color: 'var(--cf-text-secondary)', icon: '📥' },
            { label: 'IVA a pagar al SAT', value: resumen.iva_a_pagar, color: 'var(--cf-amber)', icon: '🏛' },
            { label: 'ISR estimado', value: resumen.isr_estimado, color: 'var(--cf-amber)', icon: '📊' },
            { label: 'Total a pagar al SAT', value: resumen.total_a_pagar, color: 'var(--cf-red)', icon: '⚠️' },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="cf-card"
              style={{ padding: '16px 18px' }}
            >
              <div style={{ fontSize: 11, color: 'var(--cf-text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {card.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: card.color, fontFamily: 'var(--font-mono)' }}>
                {isLoading ? '...' : formatCurrency(card.value)}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ── Explicación en lenguaje humano ── */}
      {resumen && resumen.total_a_pagar > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: '20px 24px', borderRadius: 14,
            background: 'var(--cf-amber-light)',
            border: '1px solid #EF9F2730',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: '#633806', marginBottom: 8 }}>
            💡 ¿Qué significa esto en palabras simples?
          </div>
          <p style={{ fontSize: 13, color: '#854F0B', lineHeight: 1.8, margin: 0 }}>
            Este mes tuviste ingresos de <strong>{formatCurrency(resumen.ingresos)}</strong>.
            {resumen.iva_cobrado > 0 && ` Cobraste ${formatCurrency(resumen.iva_cobrado)} de IVA a tus clientes`}
            {resumen.iva_pagado > 0 && `, pero pagaste ${formatCurrency(resumen.iva_pagado)} de IVA en tus gastos`}.
            {resumen.iva_a_pagar > 0 && ` La diferencia que debes entregarle al SAT de IVA es ${formatCurrency(resumen.iva_a_pagar)}.`}
            {resumen.isr_estimado > 0 && ` Además, tu pago provisional de ISR estimado es ${formatCurrency(resumen.isr_estimado)}.`}
            {' '}<strong>En total debes apartar {formatCurrency(resumen.total_a_pagar)} para el SAT.</strong>
            {' '}El vencimiento es el día 17 del mes siguiente.
          </p>
        </motion.div>
      )}

      {resumen && resumen.total_a_pagar === 0 && resumen.ingresos === 0 && (
        <div style={{
          padding: '20px 24px', borderRadius: 14,
          background: 'var(--cf-green-light)', border: '1px solid #97C45930',
          fontSize: 13, color: '#27500A',
        }}>
          <strong>📋 Sin ingresos registrados en este período.</strong> Registra tus ingresos y egresos para calcular automáticamente lo que le debes al SAT.
        </div>
      )}

      {/* ── Declaraciones registradas ── */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Historial de declaraciones
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 10 }} />)}
          </div>
        ) : declaraciones.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '48px 20px',
            background: 'var(--cf-bg-card)', border: '1px solid var(--cf-border)', borderRadius: 14,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏛️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--cf-text-primary)', marginBottom: 6 }}>
              Sin declaraciones registradas
            </div>
            <div style={{ fontSize: 13, color: 'var(--cf-text-tertiary)', marginBottom: 20 }}>
              Selecciona un período con ingresos y haz click en "Generar declaraciones"
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {declaraciones.map((decl, i) => {
              const dias = diasParaVencer(decl.due_date)
              const statusConf = STATUS_CONFIG[decl.status] ?? STATUS_CONFIG.pendiente
              const urgente = dias <= 5 && dias >= 0 && decl.status === 'pendiente'
              const vencida = dias < 0 && decl.status === 'pendiente'

              return (
                <motion.div
                  key={decl.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  style={{
                    padding: '16px 20px', borderRadius: 12,
                    background: 'var(--cf-bg-card)',
                    border: `1px solid ${vencida ? 'var(--cf-red)' : urgente ? 'var(--cf-amber)' : 'var(--cf-border)'}`,
                    display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                  }}
                >
                  {/* Info principal */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-text-primary)' }}>
                        {TIPO_LABELS[decl.type] ?? decl.type}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: statusConf.bg, color: statusConf.color,
                      }}>
                        {statusConf.label}
                      </span>
                      {vencida && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#FCEBEB', color: '#791F1F' }}>
                          ¡Vencida!
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--cf-text-tertiary)' }}>
                      Período: {format(new Date(decl.period + '-01'), 'MMMM yyyy', { locale: es })}
                      {' · '}Vence: {formatDate(decl.due_date)}
                      {dias >= 0 && decl.status === 'pendiente' && ` (${dias} días)`}
                    </div>
                  </div>

                  {/* Montos */}
                  <div style={{ textAlign: 'right', minWidth: 120 }}>
                    {decl.isr_calculado != null && decl.isr_calculado > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--cf-text-tertiary)' }}>
                        ISR: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatCurrency(decl.isr_calculado)}</span>
                      </div>
                    )}
                    {decl.iva_calculado != null && decl.iva_calculado > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--cf-text-tertiary)' }}>
                        IVA: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatCurrency(decl.iva_calculado)}</span>
                      </div>
                    )}
                    {((decl.isr_calculado ?? 0) + (decl.iva_calculado ?? 0)) > 0 && (
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-red)', fontFamily: 'var(--font-mono)' }}>
                        {formatCurrency((decl.isr_calculado ?? 0) + (decl.iva_calculado ?? 0))}
                      </div>
                    )}
                  </div>

                  {/* Selector de status */}
                  <select
                    value={decl.status}
                    onChange={e => actualizarStatus(decl.id, e.target.value)}
                    style={{
                      padding: '7px 10px', borderRadius: 8, fontSize: 12,
                      border: '1px solid var(--cf-border)', background: statusConf.bg,
                      color: statusConf.color, fontFamily: 'var(--font-sans)', cursor: 'pointer',
                    }}
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="presentada">Presentada</option>
                    <option value="pagada">Pagada ✓</option>
                    <option value="omitida">Omitida</option>
                  </select>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Calendario de obligaciones ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="cf-card"
        style={{ padding: '20px 24px' }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          📅 Calendario de obligaciones fiscales
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { dia: '17 de cada mes', obligacion: 'IVA mensual e ISR provisional', tipo: 'Mensual', color: 'var(--cf-amber)' },
            { dia: '31 de marzo', obligacion: 'Declaración anual personas físicas', tipo: 'Anual', color: 'var(--cf-blue)' },
            { dia: '31 de marzo', obligacion: 'Declaración anual personas morales', tipo: 'Anual', color: 'var(--cf-blue)' },
            { dia: 'Último día del mes', obligacion: 'DIOT (si aplica)', tipo: 'Mensual', color: 'var(--cf-text-tertiary)' },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '12px 0',
              borderBottom: i < 3 ? '1px solid var(--cf-border)' : 'none',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: item.color, flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--cf-text-primary)' }}>
                  {item.obligacion}
                </div>
                <div style={{ fontSize: 11, color: 'var(--cf-text-tertiary)', marginTop: 2 }}>
                  {item.dia}
                </div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                background: 'var(--cf-bg-subtle)', color: 'var(--cf-text-tertiary)',
              }}>
                {item.tipo}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

    </div>
  )
}
