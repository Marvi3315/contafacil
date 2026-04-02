import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, calcularSemaforo } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'

function useDashboardMetrics(orgId: string, period: Date) {
  return useQuery({
    queryKey: ['dashboard-metrics', orgId, format(period, 'yyyy-MM')],
    queryFn: async () => {
      const from = format(startOfMonth(period), 'yyyy-MM-dd')
      const to = format(endOfMonth(period), 'yyyy-MM-dd')
      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount, iva, date')
        .eq('org_id', orgId)
        .eq('status', 'confirmado')
        .gte('date', from)
        .lte('date', to)
      if (error) throw error
      const ingresos = (data ?? []).filter(t => t.type === 'ingreso').reduce((s, t) => s + Number(t.amount), 0)
      const egresos = (data ?? []).filter(t => t.type === 'egreso').reduce((s, t) => s + Number(t.amount), 0)
      const ivaEstimado = ingresos * 0.16 - egresos * 0.16
      const isrEstimado = ingresos * 0.01
      const impuestos = Math.max(0, ivaEstimado + isrEstimado)
      const libre = ingresos - egresos - impuestos
      return { ingresos, egresos, impuestos, libre }
    },
    enabled: !!orgId,
  })
}

function useRecentTransactions(orgId: string) {
  return useQuery({
    queryKey: ['recent-transactions', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, category:categories(name, icon, color)')
        .eq('org_id', orgId)
        .eq('status', 'confirmado')
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data ?? []
    },
    enabled: !!orgId,
  })
}

function useChartData(orgId: string) {
  return useQuery({
    queryKey: ['chart-data', orgId],
    queryFn: async () => {
      const meses = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i))
      return Promise.all(meses.map(async (mes) => {
        const from = format(startOfMonth(mes), 'yyyy-MM-dd')
        const to = format(endOfMonth(mes), 'yyyy-MM-dd')
        const { data } = await supabase
          .from('transactions')
          .select('type, amount')
          .eq('org_id', orgId)
          .eq('status', 'confirmado')
          .gte('date', from)
          .lte('date', to)
        const ingresos = (data ?? []).filter(t => t.type === 'ingreso').reduce((s, t) => s + Number(t.amount), 0)
        const egresos = (data ?? []).filter(t => t.type === 'egreso').reduce((s, t) => s + Number(t.amount), 0)
        return { mes: format(mes, 'MMM', { locale: es }), ingresos: Math.round(ingresos), egresos: Math.round(egresos) }
      }))
    },
    enabled: !!orgId,
  })
}

function Skeleton({ w = '100%', h = 20, radius = 8 }: { w?: string | number; h?: number; radius?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: radius }} />
}

function MetricCard({ label, value, sub, color, icon, delay = 0, isLoading }: {
  label: string; value: string; sub?: string; color: string; icon: string; delay?: number; isLoading?: boolean
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }} className="cf-card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
        }}>{icon}</div>
        <span style={{ fontSize: 12, color: 'var(--cf-text-tertiary)', fontWeight: 500 }}>{label}</span>
      </div>
      {isLoading
        ? <Skeleton h={28} radius={6} />
        : <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--font-mono)', letterSpacing: '-0.5px' }}>{value}</div>
      }
      {sub && !isLoading && <div style={{ fontSize: 11, color: 'var(--cf-text-tertiary)', marginTop: 4 }}>{sub}</div>}
    </motion.div>
  )
}

function SemaforoCard({ ingresos, egresos, impuestos, isLoading }: {
  ingresos: number; egresos: number; impuestos: number; isLoading: boolean
}) {
  const { status, margen } = calcularSemaforo(ingresos, egresos, impuestos)
  const config = {
    verde: { color: '#1D9E75', bg: '#EAF3DE', emoji: '✅', titulo: 'Vas muy bien este mes', msg: 'Tus ingresos superan tus gastos. Sigue así.' },
    amarillo: { color: '#BA7517', bg: '#FAEEDA', emoji: '⚠️', titulo: 'Ojo con los gastos', msg: 'Tu margen está ajustado. Revisa tus egresos.' },
    rojo: { color: '#A32D2D', bg: '#FCEBEB', emoji: '🔴', titulo: 'Mes complicado', msg: 'Tus gastos superan tus ingresos este mes.' },
  }
  const c = config[isLoading ? 'verde' : status]
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="cf-card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{
        width: 60, height: 60, borderRadius: '50%',
        background: isLoading ? 'var(--cf-bg-subtle)' : c.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, flexShrink: 0,
        animation: !isLoading && status !== 'verde' ? 'pulse-soft 2s infinite' : 'none',
      }}>{isLoading ? '⏳' : c.emoji}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--cf-text-tertiary)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Salud financiera del mes
        </div>
        {isLoading ? <Skeleton h={20} w="60%" radius={4} /> : <div style={{ fontSize: 16, fontWeight: 700, color: c.color }}>{c.titulo}</div>}
        {isLoading ? <div style={{ marginTop: 4 }}><Skeleton h={14} w="80%" radius={4} /></div>
          : <div style={{ fontSize: 13, color: 'var(--cf-text-secondary)', marginTop: 2 }}>{c.msg}</div>}
      </div>
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--cf-text-tertiary)', marginBottom: 4 }}>Margen neto</div>
        {isLoading ? <Skeleton h={32} w={60} radius={6} />
          : <div style={{ fontSize: 24, fontWeight: 700, color: c.color, fontFamily: 'var(--font-mono)' }}>{Math.round(margen)}%</div>}
        <div style={{ width: 60, height: 4, background: 'var(--cf-bg-subtle)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
          {!isLoading && (
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, margen))}%` }}
              transition={{ delay: 0.5, duration: 0.8 }}
              style={{ height: '100%', background: c.color, borderRadius: 2 }} />
          )}
        </div>
      </div>
    </motion.div>
  )
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--cf-bg-card)', border: '1px solid var(--cf-border)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--cf-text-primary)', textTransform: 'capitalize' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name === 'ingresos' ? '↑ Entró: ' : '↓ Salió: '}<strong>{formatCurrency(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { activeOrg, user } = useAuthStore()
  const [period] = useState(new Date())
  const orgId = activeOrg?.id ?? ''

  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics(orgId, period)
  const { data: recent, isLoading: recentLoading } = useRecentTransactions(orgId)
  const { data: chartData, isLoading: chartLoading } = useChartData(orgId)

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const nombreUsuario = activeOrg?.name ?? user?.email?.split('@')[0] ?? ''
  const mesActual = format(period, "MMMM 'de' yyyy", { locale: es })
  const sinDatos = !metricsLoading && metrics?.ingresos === 0 && metrics?.egresos === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <motion.h1 initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
            style={{ fontSize: 22, fontWeight: 700, color: 'var(--cf-navy)', margin: 0 }}>
            {saludo}, {nombreUsuario} 👋
          </motion.h1>
          <p style={{ fontSize: 13, color: 'var(--cf-text-tertiary)', margin: '4px 0 0', textTransform: 'capitalize' }}>
            {mesActual}
          </p>
        </div>
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          onClick={() => window.location.href = '/ingresos'}
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: 'var(--cf-navy)', color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 8,
          }}>
          + Registrar movimiento
        </motion.button>
      </div>

      {/* Semáforo */}
      <SemaforoCard
        ingresos={metrics?.ingresos ?? 0}
        egresos={metrics?.egresos ?? 0}
        impuestos={metrics?.impuestos ?? 0}
        isLoading={metricsLoading}
      />

      {/* 4 Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <MetricCard label="Entró este mes" value={formatCurrency(metrics?.ingresos ?? 0)} icon="💚" color="#1D9E75" delay={0.1} isLoading={metricsLoading} />
        <MetricCard label="Salió este mes" value={formatCurrency(metrics?.egresos ?? 0)} icon="🔴" color="#A32D2D" delay={0.15} isLoading={metricsLoading} />
        <MetricCard label="Le debo al SAT" value={formatCurrency(metrics?.impuestos ?? 0)} sub="Estimado — IVA + ISR" icon="🏛️" color="#BA7517" delay={0.2} isLoading={metricsLoading} />
        <MetricCard label="Me queda libre" value={formatCurrency(metrics?.libre ?? 0)} sub="Después de impuestos" icon="✨" color="#185FA5" delay={0.25} isLoading={metricsLoading} />
      </div>

      {/* Gráfica + Últimos movimientos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>

        {/* Gráfica */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="cf-card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-text-primary)' }}>Ingresos vs gastos</div>
              <div style={{ fontSize: 12, color: 'var(--cf-text-tertiary)' }}>Últimos 6 meses</div>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#1D9E75', display: 'inline-block' }} />
                <span style={{ color: 'var(--cf-text-secondary)' }}>Ingresos</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#F09595', display: 'inline-block' }} />
                <span style={{ color: 'var(--cf-text-secondary)' }}>Gastos</span>
              </span>
            </div>
          </div>
          {chartLoading ? (
            <Skeleton h={200} radius={8} />
          ) : sinDatos ? (
            <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{ fontSize: 40 }}>📊</div>
              <div style={{ fontSize: 13, color: 'var(--cf-text-tertiary)', textAlign: 'center', lineHeight: 1.6 }}>
                Aún no hay movimientos.<br />Registra tu primer ingreso o gasto para ver la gráfica.
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradIngreso" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradEgreso" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F09595" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#F09595" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--cf-text-tertiary)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--cf-text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="ingresos" stroke="#1D9E75" strokeWidth={2} fill="url(#gradIngreso)" />
                <Area type="monotone" dataKey="egresos" stroke="#F09595" strokeWidth={2} fill="url(#gradEgreso)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Últimos movimientos */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="cf-card" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-text-primary)', marginBottom: 16 }}>Últimos movimientos</div>
          {recentLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={48} radius={8} />)}
            </div>
          ) : !recent?.length ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 13, color: 'var(--cf-text-tertiary)', lineHeight: 1.6 }}>
                No hay movimientos aún.<br />¡Registra el primero!
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recent.map((tx: any, i: number) => (
                <motion.div key={tx.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--cf-bg-subtle)' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: tx.type === 'ingreso' ? '#EAF3DE' : '#FCEBEB',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
                  }}>{tx.category?.icon ?? (tx.type === 'ingreso' ? '💚' : '🔴')}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--cf-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tx.description}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--cf-text-tertiary)' }}>{tx.category?.name ?? '—'}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, flexShrink: 0, color: tx.type === 'ingreso' ? '#1D9E75' : '#A32D2D', fontFamily: 'var(--font-mono)' }}>
                    {tx.type === 'ingreso' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          {!!recent?.length && (
            <button onClick={() => window.location.href = '/ingresos'}
              style={{
                width: '100%', marginTop: 14, padding: '9px', background: 'none',
                border: '1px solid var(--cf-border)', borderRadius: 8, fontSize: 13,
                color: 'var(--cf-text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--cf-bg-subtle)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              Ver todos los movimientos →
            </button>
          )}
        </motion.div>
      </div>

      {/* Banner primer movimiento */}
      {sinDatos && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          style={{
            padding: '20px 24px', borderRadius: 14,
            background: 'linear-gradient(135deg, #0D1B2A 0%, #185FA5 100%)',
            display: 'flex', alignItems: 'center', gap: 20,
          }}>
          <div style={{ fontSize: 40 }}>🚀</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>¡Registra tu primer movimiento!</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              Agrega un ingreso o gasto y ContaFácil calculará tus impuestos automáticamente.
            </div>
          </div>
          <button onClick={() => window.location.href = '/ingresos'}
            style={{
              padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
            }}>
            + Registrar ahora
          </button>
        </motion.div>
      )}
    </div>
  )
}
