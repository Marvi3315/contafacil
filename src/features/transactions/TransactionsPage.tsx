import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

// ─── Schema de validación ─────────────────────────────────────────
const txSchema = z.object({
  description: z.string().min(2, 'Describe el movimiento'),
  amount: z.number({ invalid_type_error: 'Ingresa un monto válido' }).positive('El monto debe ser mayor a 0'),
  date: z.string().min(1, 'Selecciona una fecha'),
  category_id: z.string().optional(),
  payment_method: z.string().optional(),
  notes: z.string().optional(),
  iva: z.number().min(0).optional(),
})

type TxForm = z.infer<typeof txSchema>

interface Category {
  id: string
  name: string
  icon: string
  color: string
  type: string
}

interface Transaction {
  id: string
  type: string
  amount: number
  description: string
  date: string
  payment_method: string | null
  notes: string | null
  iva: number
  status: string
  categories?: { name: string; icon: string; color: string } | null
}

const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo', icon: '💵' },
  { value: 'transferencia', label: 'Transferencia', icon: '🏦' },
  { value: 'tarjeta_debito', label: 'Tarjeta débito', icon: '💳' },
  { value: 'tarjeta_credito', label: 'Tarjeta crédito', icon: '💳' },
  { value: 'cheque', label: 'Cheque', icon: '📄' },
  { value: 'otro', label: 'Otro', icon: '📋' },
]

interface Props {
  type: 'ingreso' | 'egreso'
}

export default function TransactionsPage({ type }: Props) {
  const { activeOrg } = useAuthStore()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [totalMes, setTotalMes] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  const isIngreso = type === 'ingreso'
  const color = isIngreso ? 'var(--cf-green)' : 'var(--cf-red)'
  const colorLight = isIngreso ? 'var(--cf-green-light)' : 'var(--cf-red-light)'
  const titulo = isIngreso ? '¿Cuánto entró?' : '¿Cuánto salió?'
  const subtitulo = isIngreso ? 'Registra tus ingresos del mes' : 'Registra tus gastos del mes'

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<TxForm>({
    resolver: zodResolver(txSchema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      iva: 0,
    }
  })

  useEffect(() => {
    if (!activeOrg) return
    loadData()
  }, [activeOrg, type])

  const loadData = async () => {
    if (!activeOrg) return
    setIsLoading(true)
    try {
      // Cargar transacciones
      const { data: txs, error } = await supabase
        .from('transactions')
        .select('*, categories(name, icon, color)')
        .eq('org_id', activeOrg.id)
        .eq('type', type)
        .neq('status', 'cancelado')
        .order('date', { ascending: false })

      if (error) throw error
      setTransactions(txs ?? [])

      // Total del mes actual
      const mesActual = format(new Date(), 'yyyy-MM')
      const total = (txs ?? [])
        .filter(t => t.date.startsWith(mesActual))
        .reduce((s, t) => s + Number(t.amount), 0)
      setTotalMes(total)

      // Cargar categorías del tipo
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('org_id', activeOrg.id)
        .eq('type', type)
        .order('name')

      setCategories(cats ?? [])
    } catch (err) {
      console.error('Error cargando transacciones:', err)
      toast.error('Error al cargar los datos')
    } finally {
      setIsLoading(false)
    }
  }

  const openModal = (tx?: Transaction) => {
    if (tx) {
      setEditingTx(tx)
      setValue('description', tx.description)
      setValue('amount', tx.amount)
      setValue('date', tx.date)
      setValue('category_id', tx.categories ? undefined : undefined)
      setValue('payment_method', tx.payment_method ?? '')
      setValue('notes', tx.notes ?? '')
      setValue('iva', tx.iva ?? 0)
    } else {
      setEditingTx(null)
      reset({ date: format(new Date(), 'yyyy-MM-dd'), iva: 0 })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingTx(null)
    reset()
  }

  const onSubmit = async (formData: TxForm) => {
    if (!activeOrg) return
    setIsSubmitting(true)
    try {
      const payload = {
        org_id: activeOrg.id,
        type,
        amount: formData.amount,
        description: formData.description,
        date: formData.date,
        category_id: formData.category_id || null,
        payment_method: formData.payment_method || null,
        notes: formData.notes || null,
        iva: formData.iva ?? 0,
        status: 'confirmado',
      }

      if (editingTx) {
        const { error } = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', editingTx.id)
        if (error) throw error
        toast.success('Movimiento actualizado ✓')
      } else {
        const { error } = await supabase
          .from('transactions')
          .insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id })
        if (error) throw error
        toast.success(isIngreso ? '¡Ingreso registrado! 💚' : '¡Egreso registrado!')
      }

      closeModal()
      loadData()
    } catch (err) {
      console.error('Error guardando:', err)
      toast.error('Error al guardar el movimiento')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este movimiento?')) return
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'cancelado' })
        .eq('id', id)
      if (error) throw error
      toast.success('Movimiento eliminado')
      loadData()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const txsFiltradas = transactions.filter(tx =>
    tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tx.categories?.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Agrupar por mes
  const grupos: Record<string, Transaction[]> = {}
  txsFiltradas.forEach(tx => {
    const mes = tx.date.slice(0, 7)
    if (!grupos[mes]) grupos[mes] = []
    grupos[mes].push(tx)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--cf-navy)', margin: '0 0 4px' }}>
            {titulo}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--cf-text-tertiary)', margin: 0 }}>{subtitulo}</p>
        </div>
        <button
          onClick={() => openModal()}
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: isIngreso ? 'var(--cf-green)' : 'var(--cf-navy)',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          + {isIngreso ? 'Registrar ingreso' : 'Registrar gasto'}
        </button>
      </div>

      {/* ── Tarjeta resumen del mes ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: colorLight,
          border: `1px solid ${color}30`,
          borderRadius: 14, padding: '20px 24px',
          display: 'flex', alignItems: 'center', gap: 20,
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: color, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 20, color: '#fff', flexShrink: 0,
        }}>
          {isIngreso ? '↑' : '↓'}
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--cf-text-tertiary)', marginBottom: 4 }}>
            Total {isIngreso ? 'ingresos' : 'egresos'} — {format(new Date(), 'MMMM yyyy', { locale: es })}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>
            {isLoading ? '...' : formatCurrency(totalMes)}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'var(--cf-text-tertiary)', marginBottom: 4 }}>
            Movimientos este mes
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--cf-text-primary)', fontFamily: 'var(--font-mono)' }}>
            {transactions.filter(t => t.date.startsWith(format(new Date(), 'yyyy-MM'))).length}
          </div>
        </div>
      </motion.div>

      {/* ── Buscador ── */}
      <input
        type="text"
        placeholder={`Buscar ${isIngreso ? 'ingresos' : 'egresos'}...`}
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        style={{
          width: '100%', padding: '11px 16px', fontSize: 14,
          borderRadius: 10, border: '1px solid var(--cf-border)',
          background: 'var(--cf-bg-card)', color: 'var(--cf-text-primary)',
          outline: 'none', fontFamily: 'var(--font-sans)',
          boxSizing: 'border-box',
        }}
      />

      {/* ── Lista de transacciones agrupadas por mes ── */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }} />
          ))}
        </div>
      ) : txsFiltradas.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            textAlign: 'center', padding: '60px 20px',
            background: 'var(--cf-bg-card)',
            border: '1px solid var(--cf-border)',
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>
            {isIngreso ? '💚' : '📋'}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--cf-text-primary)', marginBottom: 6 }}>
            {searchQuery ? 'Sin resultados' : `Sin ${isIngreso ? 'ingresos' : 'gastos'} registrados`}
          </div>
          <div style={{ fontSize: 13, color: 'var(--cf-text-tertiary)', marginBottom: 20 }}>
            {searchQuery ? 'Intenta con otra búsqueda' : `Registra tu primer ${isIngreso ? 'ingreso' : 'gasto'}`}
          </div>
          {!searchQuery && (
            <button
              onClick={() => openModal()}
              style={{
                padding: '10px 24px', borderRadius: 10, border: 'none',
                background: isIngreso ? 'var(--cf-green)' : 'var(--cf-navy)',
                color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              + Registrar ahora
            </button>
          )}
        </motion.div>
      ) : (
        Object.entries(grupos)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([mes, txs]) => (
            <div key={mes}>
              {/* Encabezado de mes */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 8, padding: '0 4px',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cf-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {format(new Date(mes + '-01'), 'MMMM yyyy', { locale: es })}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color, fontFamily: 'var(--font-mono)' }}>
                  {formatCurrency(txs.reduce((s, t) => s + Number(t.amount), 0))}
                </span>
              </div>

              {/* Transacciones del mes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {txs.map((tx, i) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', borderRadius: 10,
                      background: 'var(--cf-bg-card)',
                      border: '1px solid var(--cf-border)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--cf-border-md)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--cf-border)')}
                    onClick={() => openModal(tx)}
                  >
                    {/* Ícono categoría */}
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: colorLight, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, flexShrink: 0,
                    }}>
                      {tx.categories?.icon ?? (isIngreso ? '💰' : '💸')}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--cf-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.description}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--cf-text-tertiary)', marginTop: 2, display: 'flex', gap: 8 }}>
                        <span>{tx.categories?.name ?? 'Sin categoría'}</span>
                        <span>·</span>
                        <span>{formatDate(tx.date, 'dd MMM yyyy')}</span>
                        {tx.payment_method && (
                          <>
                            <span>·</span>
                            <span>{PAYMENT_METHODS.find(p => p.value === tx.payment_method)?.label ?? tx.payment_method}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Monto */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>
                        {isIngreso ? '+' : '-'}{formatCurrency(tx.amount)}
                      </div>
                      {tx.iva > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--cf-text-tertiary)' }}>
                          IVA: {formatCurrency(tx.iva)}
                        </div>
                      )}
                    </div>

                    {/* Botón eliminar */}
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(tx.id) }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--cf-text-tertiary)', fontSize: 16, padding: 4,
                        borderRadius: 6, transition: 'all 0.15s', flexShrink: 0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--cf-red)'; e.currentTarget.style.background = 'var(--cf-red-light)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--cf-text-tertiary)'; e.currentTarget.style.background = 'none' }}
                    >
                      ✕
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          ))
      )}

      {/* ── Modal registro ── */}
      <AnimatePresence>
        {showModal && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              style={{
                position: 'fixed', inset: 0, zIndex: 50,
                background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
              }}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{
                position: 'fixed', inset: 0, zIndex: 51,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 20, pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  background: 'var(--cf-bg-card)',
                  border: '1px solid var(--cf-border)',
                  borderRadius: 20, padding: '28px 32px',
                  width: '100%', maxWidth: 520,
                  maxHeight: '90vh', overflowY: 'auto',
                  pointerEvents: 'all',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.16)',
                }}
              >
                {/* Header modal */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--cf-navy)', margin: 0 }}>
                    {editingTx ? 'Editar movimiento' : isIngreso ? '💚 Registrar ingreso' : '🔴 Registrar gasto'}
                  </h2>
                  <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--cf-text-tertiary)' }}>✕</button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Descripción */}
                    <div>
                      <label style={labelStyle}>¿Qué fue este {isIngreso ? 'ingreso' : 'gasto'}?</label>
                      <input
                        {...register('description')}
                        placeholder={isIngreso ? 'Ej: Pago cliente — Sitio web' : 'Ej: Renta de oficina'}
                        style={inputStyle}
                        autoFocus
                      />
                      {errors.description && <p style={errorStyle}>{errors.description.message}</p>}
                    </div>

                    {/* Monto + IVA */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Monto ($MXN)</label>
                        <input
                          {...register('amount', { valueAsNumber: true })}
                          type="number" step="0.01" min="0"
                          placeholder="0.00"
                          style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                        />
                        {errors.amount && <p style={errorStyle}>{errors.amount.message}</p>}
                      </div>
                      <div>
                        <label style={labelStyle}>IVA ($)</label>
                        <input
                          {...register('iva', { valueAsNumber: true })}
                          type="number" step="0.01" min="0"
                          placeholder="0.00"
                          style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                        />
                      </div>
                    </div>

                    {/* Fecha */}
                    <div>
                      <label style={labelStyle}>Fecha</label>
                      <input
                        {...register('date')}
                        type="date"
                        style={inputStyle}
                      />
                      {errors.date && <p style={errorStyle}>{errors.date.message}</p>}
                    </div>

                    {/* Categoría */}
                    <div>
                      <label style={labelStyle}>Categoría</label>
                      <select {...register('category_id')} style={inputStyle}>
                        <option value="">Sin categoría</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.icon} {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Forma de pago */}
                    <div>
                      <label style={labelStyle}>¿Cómo se pagó?</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                        {PAYMENT_METHODS.map(pm => (
                          <label
                            key={pm.value}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                              border: `1px solid ${watch('payment_method') === pm.value ? color : 'var(--cf-border)'}`,
                              background: watch('payment_method') === pm.value ? colorLight : 'var(--cf-bg)',
                              fontSize: 12, transition: 'all 0.15s',
                            }}
                          >
                            <input
                              type="radio"
                              value={pm.value}
                              {...register('payment_method')}
                              style={{ display: 'none' }}
                            />
                            <span>{pm.icon}</span>
                            <span style={{ color: 'var(--cf-text-secondary)' }}>{pm.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Notas */}
                    <div>
                      <label style={labelStyle}>Notas (opcional)</label>
                      <textarea
                        {...register('notes')}
                        placeholder="Cualquier detalle adicional..."
                        rows={2}
                        style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }}
                      />
                    </div>

                    {/* Botones */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={closeModal}
                        style={{
                          flex: 1, padding: '12px', borderRadius: 10,
                          border: '1px solid var(--cf-border)',
                          background: 'none', color: 'var(--cf-text-secondary)',
                          fontSize: 14, cursor: 'pointer',
                          fontFamily: 'var(--font-sans)',
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        style={{
                          flex: 2, padding: '12px', borderRadius: 10, border: 'none',
                          background: isIngreso ? 'var(--cf-green)' : 'var(--cf-navy)',
                          color: '#fff', fontSize: 14, fontWeight: 600,
                          cursor: isSubmitting ? 'not-allowed' : 'pointer',
                          fontFamily: 'var(--font-sans)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          opacity: isSubmitting ? 0.7 : 1,
                        }}
                      >
                        {isSubmitting ? (
                          <>
                            <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                            Guardando...
                          </>
                        ) : editingTx ? 'Guardar cambios' : `Registrar ${isIngreso ? 'ingreso' : 'gasto'}`}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Estilos reutilizables ────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 500,
  color: 'var(--cf-text-secondary)', marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', fontSize: 14,
  borderRadius: 10, border: '1px solid var(--cf-border)',
  background: 'var(--cf-bg)', color: 'var(--cf-text-primary)',
  outline: 'none', fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box', transition: 'border-color 0.2s',
}

const errorStyle: React.CSSProperties = {
  fontSize: 12, color: 'var(--cf-red)', marginTop: 4,
}
