import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatPeriod, calcularSemaforo } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'

interface Metrics {
  ingresos: number
  egresos: number
  impuestos: number
  libre: number
  margen: number
  semaforo: 'verde' | 'amarillo' | 'rojo'
}

interface ChartPoint { mes: string; ingresos: number; egresos: number }
interface Declaracion { id: string; type: string; due_date: string; status: string; isr_calculado: number | null; iva_calculado: number | null }
interface Transaccion { id: string; type: string; amount: number; description: string; date: string; payment_method: string | null; categories?: { name: string; icon: string } | null }

const SEMAFORO_CONFIG = {
  verde:    { color: '#1D9E75', bg: '#EAF3DE', icono: '✓', titulo: 'Vas muy bien',    mensaje: 'Tus ingresos superan tus gastos. ¡Sigue así!' },
  amarillo: { color: '#BA7517', bg: '#FAEEDA', icono: '!', titulo: 'Ojo con los gastos', mensaje: 'Tu margen está ajustado. Revisa tus egresos.' },
  rojo:     { color: '#A32D2D', bg: '#FCEBEB', icono: '✕', titulo: 'Mes complicado',  mensaje: 'Tus gastos superan tus ingresos este mes.' },
}

const Sk = ({ h = 20, w = '100%' }: { h?: number; w?: string }) => (
  <div className="skeleton" style={{ height: h, width: w, borderRadius: 8 }} />
)

// Hook para detectar tamaño de pantalla
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

function useIsTablet() {
  const [isTablet, setIsTablet] = useState(window.innerWidth < 1024)
  useEffect(() => {
    const handler = () => setIsTablet(window.innerWidth < 1024)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isTablet
}

export default function DashboardPage() {
  const { activeOrg, user } = useAuthStore()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [declaraciones, setDeclaraciones] = useState<Declaracion[]>([])
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [periodo, setPeriodo] = useState(format(new Date(), 'yyyy-MM'))
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()

  const nombreUsuario = user?.email?.split('@')[0] ?? 'por aquí'
  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'

  useEffect(() => {
    if (activeOrg) loadDashboard()
  }, [activeOrg, periodo])

  const loadDashboard = async () => {
    if (!activeOrg) return
    setIsLoading(true)
    const [year, month] = periodo.split('-')
    const desde = format(startOfMonth(new Date(parseInt(year), parseInt(month) - 1)), 'yyyy-MM-dd')
    const hasta = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), 'yyyy-MM-dd')

    try {
      const { data: txs } = await supabase
        .from('transactions')
        .select('*, categories(name, icon)')
        .eq('org_id', activeOrg.id)
        .eq('status', 'confirmado')
        .gte('date', desde)
        .lte('date', hasta)
        .order('date', { ascending: false })

      const ingresos = (txs ?? []).filter(t => t.type === 'ingreso').reduce((s, t) => s + Number(t.amount), 0)
      const egresos = (txs ?? []).filter(t => t.type === 'egreso').reduce((s, t) => s + Number(t.amount), 0)
      const impuestos = (txs ?? []).reduce((s, t) => s + Number(t.iva ?? 0), 0)
      const { status, margen } = calcularSemaforo(ingresos, egresos, impuestos)

      setMetrics({ ingresos, egresos, impuestos, libre: ingresos - egresos - impuestos, margen, semaforo: status })
      setTransacciones((txs ?? []).slice(0, 5))

      // Gráfica 6 meses
      const meses: ChartPoint[] = []
      for (let i = 5; i >= 0; i--) {
        const fecha = subMonths(new Date(), i)
        const ini = format(startOfMonth(fecha), 'yyyy-MM-dd')
        const fin = format(endOfMonth(fecha), 'yyyy-MM-dd')
        const { data: mtxs } = await supabase
          .from('transactions').select('type, amount')
          .eq('org_id', activeOrg.id).eq('status', 'confirmado')
          .gte('date', ini).lte('date', fin)
        const ing = (mtxs ?? []).filter(t => t.type === 'ingreso').reduce((s, t) => s + Number(t.amount), 0)
        const egr = (mtxs ?? []).filter(t => t.type === 'egreso').reduce((s, t) => s + Number(t.amount), 0)
        meses.push({ mes: format(fecha, 'MMM', { locale: es }), ingresos: ing, egresos: egr })
      }
      setChartData(meses)

      const { data: decls } = await supabase
        .from('tax_declarations').select('*')
        .eq('org_id', activeOrg.id)
        .in('status', ['pendiente', 'presentada'])
        .order('due_date', { ascending: true }).limit(3)
      setDeclaraciones(decls ?? [])
    } catch (err) {
      toast.error('Error cargando dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const sem = metrics ? SEMAFORO_CONFIG[metrics.semaforo] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 20 }}>

      {/* ── Topbar ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: 'var(--cf-navy)', margin: 0 }}>
            {saludo}, {nombreUsuario} 👋
          </h1>
          <p style={{ fontSize: 12, color: 'var(--cf-text-tertiary)', margin: '2px 0 0' }}>
            {activeOrg?.name} · {formatPeriod(periodo)}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={periodo}
            onChange={e => setPeriodo(e.target.value)}
            style={{
              padding: isMobile ? '6px 10px' : '8px 12px',
              borderRadius: 8, fontSize: isMobile ? 12 : 13,
              border: '1px solid var(--cf-border)',
              background: 'var(--cf-bg-card)',
              color: 'var(--cf-text-primary)',
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => {
              const d = subMonths(new Date(), i)
              const val = format(d, 'yyyy-MM')
              const label = format(d, 'MMMM yyyy', { locale: es })
              return <option key={val} value={val}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>
            })}
          </select>
          {!isMobile && (
            <button style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: 'var(--cf-navy)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}>
              + Registrar
            </button>
          )}
        </div>
      </div>

      {/* ── Semáforo ── */}
      {isLoading ? <Sk h={isMobile ? 80 : 90} /> : metrics && sem ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="cf-card"
          style={{ padding: isMobile ? '14px 16px' : '20px 24px', display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 20, flexWrap: 'wrap' }}
        >
          <div style={{
            width: isMobile ? 44 : 56, height: isMobile ? 44 : 56, borderRadius: '50%',
            background: sem.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: isMobile ? 18 : 22, color: '#fff', fontWeight: 700,
          }}>
            {sem.icono}
          </div>
          <div style={{ flex: 1, minWidth: isMobile ? '100%' : 200 }}>
            <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: sem.color }}>{sem.titulo}</div>
            <div style={{ fontSize: isMobile ? 12 : 13, color: 'var(--cf-text-tertiary)', marginTop: 2 }}>{sem.mensaje}</div>
          </div>
          <div style={{ flex: isMobile ? 'none' : 1, width: isMobile ? '100%' : 'auto', minWidth: 180 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--cf-text-tertiary)', marginBottom: 6 }}>
              <span>Margen neto</span>
              <span style={{ fontWeight: 600, color: sem.color, fontFamily: 'var(--font-mono)' }}>{Math.max(0, Math.round(metrics.margen))}%</span>
            </div>
            <div style={{ height: 6, background: 'var(--cf-bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, metrics.margen))}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{ height: '100%', background: sem.color, borderRadius: 3 }}
              />
            </div>
          </div>
        </motion.div>
      ) : null}

      {/* ── 4 Métricas ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0,1fr))',
        gap: isMobile ? 10 : 12,
      }}>
        {[
          { label: 'Entró este mes',    value: metrics?.ingresos ?? 0,   color: 'var(--cf-green)',  icon: '↑' },
          { label: 'Salió este mes',    value: metrics?.egresos ?? 0,    color: 'var(--cf-red)',    icon: '↓' },
          { label: 'Le debo al SAT',    value: metrics?.impuestos ?? 0,  color: 'var(--cf-amber)',  icon: '🏛' },
          { label: 'Me queda libre',    value: metrics?.libre ?? 0,      color: 'var(--cf-navy)',   icon: '✓' },
        ].map((card, i) => (
          <motion.div key={card.label}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="cf-card cf-card-hover"
            style={{ padding: isMobile ? '12px 14px' : '18px 20px' }}
          >
            {isLoading ? (
              <><Sk h={12} w="60%" /><div style={{ marginTop: 8 }}><Sk h={isMobile ? 22 : 28} w="80%" /></div></>
            ) : (
              <>
                <div style={{ fontSize: isMobile ? 10 : 11, color: 'var(--cf-text-tertiary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  {card.label}
                </div>
                <div style={{ fontSize: isMobile ? 16 : 22, fontWeight: 700, color: card.color, fontFamily: 'var(--font-mono)' }}>
                  {formatCurrency(card.value)}
                </div>
              </>
            )}
          </motion.div>
        ))}
      </div>

      {/* ── Gráfica + SAT — una columna en móvil/tablet ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isTablet ? '1fr' : '1fr 340px',
        gap: isMobile ? 14 : 16,
      }}>
        {/* Gráfica */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="cf-card" style={{ padding: isMobile ? '14px 16px' : '20px 24px' }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cf-text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Ingresos vs Egresos — últimos 6 meses
          </div>
          {isLoading ? <Sk h={isMobile ? 150 : 200} /> : (
            <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A32D2D" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#A32D2D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cf-border)" />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--cf-text-tertiary)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--cf-text-tertiary)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} />
                <Tooltip
                  contentStyle={{ background: 'var(--cf-bg-card)', border: '1px solid var(--cf-border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                />
                <Area type="monotone" dataKey="ingresos" stroke="#1D9E75" strokeWidth={2} fill="url(#gradI)" name="Ingresos" />
                <Area type="monotone" dataKey="egresos" stroke="#A32D2D" strokeWidth={2} fill="url(#gradE)" name="Egresos" />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            {[{ color: '#1D9E75', label: 'Ingresos' }, { color: '#A32D2D', label: 'Egresos' }].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--cf-text-tertiary)' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Panel SAT */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="cf-card" style={{ padding: isMobile ? '14px 16px' : '20px 24px' }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cf-text-secondary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ¿Qué le debo al SAT?
          </div>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Sk h={50} /><Sk h={50} /><Sk h={50} />
            </div>
          ) : declaraciones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--cf-text-tertiary)', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
              Sin obligaciones pendientes este mes
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {declaraciones.map(d => {
                const dias = Math.ceil((new Date(d.due_date).getTime() - Date.now()) / 86400000)
                const urgente = dias <= 5
                return (
                  <div key={d.id} style={{
                    padding: '10px 12px', borderRadius: 10,
                    background: urgente ? 'var(--cf-red-light)' : 'var(--cf-bg-subtle)',
                    border: `1px solid ${urgente ? 'var(--cf-red)' : 'var(--cf-border)'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cf-text-primary)' }}>
                        {d.type === 'iva_mensual' ? 'IVA Mensual' : 'ISR Mensual'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--cf-text-tertiary)', marginTop: 2 }}>
                        Vence: {format(new Date(d.due_date), 'dd MMM', { locale: es })}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                      background: dias < 0 ? '#A32D2D' : urgente ? '#BA7517' : '#1D9E75',
                      color: '#fff',
                    }}>
                      {dias < 0 ? 'Vencida' : `${dias}d`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {metrics && metrics.impuestos > 0 && (
            <div style={{
              marginTop: 14, padding: '10px 12px',
              background: 'var(--cf-amber-light)', borderRadius: 10,
              fontSize: 12, color: 'var(--cf-amber)',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>Estimado este mes</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{formatCurrency(metrics.impuestos)}</span>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Últimas transacciones ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="cf-card" style={{ padding: isMobile ? '14px 16px' : '20px 24px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cf-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Últimos movimientos
          </div>
          <button style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--cf-blue)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            Ver todos →
          </button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <Sk key={i} h={52} />)}
          </div>
        ) : transacciones.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--cf-text-tertiary)', fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
            Aún no hay movimientos registrados este mes.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {transacciones.map((tx, i) => (
              <motion.div key={tx.id}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 12,
                  padding: isMobile ? '8px 10px' : '10px 14px',
                  borderRadius: 10, background: 'var(--cf-bg-subtle)',
                }}
              >
                <div style={{
                  width: isMobile ? 28 : 32, height: isMobile ? 28 : 32,
                  borderRadius: '50%', flexShrink: 0,
                  background: tx.type === 'ingreso' ? 'var(--cf-green-light)' : 'var(--cf-red-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                }}>
                  {tx.categories?.icon ?? (tx.type === 'ingreso' ? '↑' : '↓')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 500, color: 'var(--cf-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tx.description}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--cf-text-tertiary)' }}>
                    {tx.categories?.name ?? ''} · {format(new Date(tx.date), 'dd MMM', { locale: es })}
                  </div>
                </div>
                <div style={{
                  fontSize: isMobile ? 13 : 14, fontWeight: 700,
                  color: tx.type === 'ingreso' ? 'var(--cf-green)' : 'var(--cf-red)',
                  fontFamily: 'var(--font-mono)', flexShrink: 0,
                }}>
                  {tx.type === 'ingreso' ? '+' : '-'}{formatCurrency(tx.amount)}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

    </div>
  )
}
