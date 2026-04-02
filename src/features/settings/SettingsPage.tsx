import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { validarRFC } from '@/lib/utils'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

type TabId = 'organizacion' | 'cuenta' | 'categorias' | 'plan'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'organizacion', label: 'Mi negocio', icon: '🏢' },
  { id: 'cuenta', label: 'Mi cuenta', icon: '👤' },
  { id: 'categorias', label: 'Categorías', icon: '🏷️' },
  { id: 'plan', label: 'Plan y facturación', icon: '💳' },
]

const REGIMENES = [
  { code: '621', label: 'RESICO — Régimen Simplificado de Confianza' },
  { code: '612', label: 'Actividad Empresarial y Profesional' },
  { code: '601', label: 'General de Ley Personas Morales' },
  { code: '606', label: 'Arrendamiento' },
  { code: '625', label: 'Plataformas Tecnológicas' },
  { code: '616', label: 'Sin obligaciones fiscales' },
]

const PLAN_CONFIG = {
  free:        { label: 'Gratis',       color: '#718096', precio: '$0' },
  emprendedor: { label: 'Emprendedor',  color: '#185FA5', precio: '$299' },
  pyme:        { label: 'PyME',         color: '#1D9E75', precio: '$599' },
  agencia:     { label: 'Agencia',      color: '#BA7517', precio: '$1,499' },
}

interface Category {
  id: string
  name: string
  icon: string
  color: string
  type: 'ingreso' | 'egreso'
  is_default: boolean
}

export default function SettingsPage() {
  const { activeOrg, user, setActiveOrg, activeRole, activePlan, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('organizacion')
  const [isSaving, setIsSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingCats, setIsLoadingCats] = useState(false)
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCat, setNewCat] = useState({ name: '', icon: '📋', color: '#185FA5', type: 'ingreso' as 'ingreso' | 'egreso' })

  // Form org
  const [orgForm, setOrgForm] = useState({
    name: activeOrg?.name ?? '',
    rfc: activeOrg?.rfc ?? '',
    regimen_fiscal: activeOrg?.regimen_fiscal ?? '',
    regimen_code: activeOrg?.regimen_code ?? '',
  })

  useEffect(() => {
    if (activeOrg) {
      setOrgForm({
        name: activeOrg.name,
        rfc: activeOrg.rfc ?? '',
        regimen_fiscal: activeOrg.regimen_fiscal ?? '',
        regimen_code: activeOrg.regimen_code ?? '',
      })
    }
  }, [activeOrg])

  useEffect(() => {
    if (activeTab === 'categorias') loadCategories()
  }, [activeTab])

  const loadCategories = async () => {
    if (!activeOrg) return
    setIsLoadingCats(true)
    try {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('org_id', activeOrg.id)
        .order('type')
        .order('name')
      setCategories(data ?? [])
    } finally {
      setIsLoadingCats(false)
    }
  }

  const saveOrg = async () => {
    if (!activeOrg) return
    if (!orgForm.name.trim()) { toast.error('El nombre es requerido'); return }

    setIsSaving(true)
    try {
      const { data, error } = await supabase
        .from('organizations')
        .update({
          name: orgForm.name.trim(),
          rfc: orgForm.rfc || null,
          regimen_fiscal: orgForm.regimen_fiscal || null,
          regimen_code: orgForm.regimen_code || null,
        })
        .eq('id', activeOrg.id)
        .select()
        .single()

      if (error) throw error
      setActiveOrg(data, activeRole ?? 'owner', activePlan ?? 'free')
      toast.success('¡Datos actualizados correctamente! ✓')
    } catch {
      toast.error('Error al guardar los cambios')
    } finally {
      setIsSaving(false)
    }
  }

  const addCategory = async () => {
    if (!activeOrg || !newCat.name.trim()) { toast.error('Escribe un nombre para la categoría'); return }
    try {
      const { error } = await supabase.from('categories').insert({
        org_id: activeOrg.id,
        name: newCat.name.trim(),
        icon: newCat.icon,
        color: newCat.color,
        type: newCat.type,
        is_default: false,
      })
      if (error) throw error
      toast.success('Categoría agregada ✓')
      setNewCat({ name: '', icon: '📋', color: '#185FA5', type: 'ingreso' })
      setShowNewCat(false)
      loadCategories()
    } catch {
      toast.error('Error al agregar la categoría')
    }
  }

  const deleteCategory = async (id: string) => {
    if (!confirm('¿Eliminar esta categoría? Los movimientos que la usen quedarán sin categoría.')) return
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
      toast.success('Categoría eliminada')
      loadCategories()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    clearAuth()
    navigate('/login')
  }

  const ingresos = categories.filter(c => c.type === 'ingreso')
  const egresos = categories.filter(c => c.type === 'egreso')

  const planActual = PLAN_CONFIG[activePlan ?? 'free']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--cf-navy)', margin: '0 0 4px' }}>
          ⚙️ Configuración
        </h1>
        <p style={{ fontSize: 13, color: 'var(--cf-text-tertiary)', margin: 0 }}>
          Administra tu negocio, cuenta y preferencias
        </p>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex', gap: 4,
        background: 'var(--cf-bg-subtle)',
        borderRadius: 10, padding: 4,
        flexWrap: 'wrap',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: activeTab === tab.id ? 'var(--cf-bg-card)' : 'transparent',
              color: activeTab === tab.id ? 'var(--cf-navy)' : 'var(--cf-text-secondary)',
              fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
              boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: 15 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Contenido por tab ── */}
      <AnimatePresence mode="wait">

        {/* ── TAB: Mi negocio ── */}
        {activeTab === 'organizacion' && (
          <motion.div key="org" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="cf-card" style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-navy)' }}>
              Datos de tu negocio
            </div>

            {/* Nombre */}
            <div>
              <label style={labelStyle}>Nombre del negocio</label>
              <input
                value={orgForm.name}
                onChange={e => setOrgForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nombre de tu empresa o negocio"
                style={inputStyle}
              />
            </div>

            {/* RFC */}
            <div>
              <label style={labelStyle}>RFC</label>
              <div style={{ position: 'relative' }}>
                <input
                  value={orgForm.rfc}
                  onChange={e => setOrgForm(f => ({ ...f, rfc: e.target.value.toUpperCase() }))}
                  placeholder="XAXX010101000"
                  maxLength={13}
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', paddingRight: 44 }}
                />
                {orgForm.rfc.length >= 12 && (
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>
                    {validarRFC(orgForm.rfc) ? '✅' : '❌'}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 11, color: 'var(--cf-text-tertiary)', marginTop: 4 }}>
                Opcional. Lo usamos para calcular tus impuestos correctamente.
              </p>
            </div>

            {/* Régimen */}
            <div>
              <label style={labelStyle}>Régimen fiscal</label>
              <select
                value={orgForm.regimen_code}
                onChange={e => {
                  const r = REGIMENES.find(r => r.code === e.target.value)
                  setOrgForm(f => ({ ...f, regimen_code: e.target.value, regimen_fiscal: r?.label.split(' — ')[0] ?? '' }))
                }}
                style={inputStyle}
              >
                <option value="">Selecciona tu régimen</option>
                {REGIMENES.map(r => (
                  <option key={r.code} value={r.code}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Info actual */}
            <div style={{
              padding: '14px 16px', borderRadius: 10,
              background: 'var(--cf-bg-subtle)',
              border: '1px solid var(--cf-border)',
              fontSize: 13,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Organización', value: activeOrg?.name },
                  { label: 'RFC', value: activeOrg?.rfc ?? 'No registrado' },
                  { label: 'Régimen', value: activeOrg?.regimen_fiscal ?? 'No configurado' },
                  { label: 'Clave SAT', value: activeOrg?.regimen_code ?? '—' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: 10, color: 'var(--cf-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--cf-text-primary)' }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={saveOrg}
              disabled={isSaving}
              style={{
                padding: '12px 28px', borderRadius: 10, border: 'none',
                background: isSaving ? 'var(--cf-bg-subtle)' : 'var(--cf-green)',
                color: isSaving ? 'var(--cf-text-tertiary)' : '#fff',
                fontSize: 14, fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)', alignSelf: 'flex-start',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {isSaving ? '⏳ Guardando...' : '✓ Guardar cambios'}
            </button>
          </motion.div>
        )}

        {/* ── TAB: Mi cuenta ── */}
        {activeTab === 'cuenta' && (
          <motion.div key="cuenta" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {/* Info usuario */}
            <div className="cf-card" style={{ padding: '24px 28px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-navy)', marginBottom: 16 }}>
                Información de tu cuenta
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'var(--cf-navy)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 700, color: '#fff',
                }}>
                  {activeOrg?.name?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--cf-text-primary)' }}>
                    {activeOrg?.name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--cf-text-tertiary)' }}>
                    {user?.email}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Correo electrónico', value: user?.email },
                  { label: 'Rol en la organización', value: activeRole === 'owner' ? 'Dueño / Propietario' : activeRole },
                  { label: 'Último acceso', value: user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('es-MX') : 'N/A' },
                  { label: 'ID de usuario', value: user?.id?.slice(0, 8) + '...' },
                ].map(item => (
                  <div key={item.label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '10px 0', borderBottom: '1px solid var(--cf-border)',
                    fontSize: 13,
                  }}>
                    <span style={{ color: 'var(--cf-text-tertiary)' }}>{item.label}</span>
                    <span style={{ color: 'var(--cf-text-primary)', fontWeight: 500 }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Seguridad */}
            <div className="cf-card" style={{ padding: '24px 28px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-navy)', marginBottom: 4 }}>
                Seguridad
              </div>
              <p style={{ fontSize: 13, color: 'var(--cf-text-tertiary)', marginBottom: 16 }}>
                ContaFácil usa magic links — no tienes contraseña. Cada acceso requiere verificación por email.
              </p>
              <div style={{
                padding: '12px 16px', borderRadius: 10,
                background: 'var(--cf-green-light)',
                border: '1px solid #97C45930',
                fontSize: 13, color: '#27500A',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 18 }}>🔒</span>
                Tu cuenta está protegida con autenticación sin contraseña (magic link)
              </div>
            </div>

            {/* Cerrar sesión */}
            <div className="cf-card" style={{ padding: '24px 28px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-navy)', marginBottom: 4 }}>
                Sesión
              </div>
              <p style={{ fontSize: 13, color: 'var(--cf-text-tertiary)', marginBottom: 16 }}>
                Al cerrar sesión necesitarás usar tu correo para volver a entrar.
              </p>
              <button
                onClick={handleLogout}
                style={{
                  padding: '10px 20px', borderRadius: 10,
                  border: '1px solid var(--cf-red)',
                  background: 'var(--cf-red-light)',
                  color: 'var(--cf-red)', fontSize: 13,
                  fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Cerrar sesión
              </button>
            </div>
          </motion.div>
        )}

        {/* ── TAB: Categorías ── */}
        {activeTab === 'categorias' && (
          <motion.div key="cats" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--cf-text-tertiary)', margin: 0 }}>
                Personaliza las categorías para clasificar tus ingresos y gastos.
              </p>
              <button
                onClick={() => setShowNewCat(v => !v)}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: 'var(--cf-navy)', color: '#fff',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                + Nueva categoría
              </button>
            </div>

            {/* Form nueva categoría */}
            <AnimatePresence>
              {showNewCat && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="cf-card"
                  style={{ padding: '20px 24px', overflow: 'hidden' }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-navy)', marginBottom: 16 }}>
                    Nueva categoría
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
                    <div>
                      <label style={labelStyle}>Nombre</label>
                      <input
                        value={newCat.name}
                        onChange={e => setNewCat(c => ({ ...c, name: e.target.value }))}
                        placeholder="Ej: Publicidad digital"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Ícono (emoji)</label>
                      <input
                        value={newCat.icon}
                        onChange={e => setNewCat(c => ({ ...c, icon: e.target.value }))}
                        placeholder="📋"
                        style={{ ...inputStyle, textAlign: 'center', fontSize: 18 }}
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Tipo</label>
                      <select
                        value={newCat.type}
                        onChange={e => setNewCat(c => ({ ...c, type: e.target.value as 'ingreso' | 'egreso' }))}
                        style={inputStyle}
                      >
                        <option value="ingreso">Ingreso</option>
                        <option value="egreso">Egreso</option>
                      </select>
                    </div>
                    <button
                      onClick={addCategory}
                      style={{
                        padding: '11px 16px', borderRadius: 10, border: 'none',
                        background: 'var(--cf-green)', color: '#fff',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      Agregar
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Lista categorías */}
            {isLoadingCats ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 10 }} />)}
              </div>
            ) : (
              <>
                {/* Ingresos */}
                <div className="cf-card" style={{ padding: '20px 24px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-green)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    ↑ Categorías de ingresos ({ingresos.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ingresos.map(cat => (
                      <div key={cat.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px', borderRadius: 8,
                        background: 'var(--cf-bg-subtle)',
                      }}>
                        <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{cat.icon}</span>
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--cf-text-primary)', fontWeight: 500 }}>{cat.name}</span>
                        {cat.is_default && (
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--cf-green-light)', color: '#27500A' }}>
                            Por defecto
                          </span>
                        )}
                        {!cat.is_default && (
                          <button
                            onClick={() => deleteCategory(cat.id)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--cf-text-tertiary)', fontSize: 14, padding: '2px 6px',
                              borderRadius: 4, transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--cf-red)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--cf-text-tertiary)'}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Egresos */}
                <div className="cf-card" style={{ padding: '20px 24px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-red)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    ↓ Categorías de egresos ({egresos.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {egresos.map(cat => (
                      <div key={cat.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px', borderRadius: 8,
                        background: 'var(--cf-bg-subtle)',
                      }}>
                        <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{cat.icon}</span>
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--cf-text-primary)', fontWeight: 500 }}>{cat.name}</span>
                        {cat.is_default && (
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--cf-red-light)', color: '#791F1F' }}>
                            Por defecto
                          </span>
                        )}
                        {!cat.is_default && (
                          <button
                            onClick={() => deleteCategory(cat.id)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--cf-text-tertiary)', fontSize: 14, padding: '2px 6px',
                              borderRadius: 4, transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--cf-red)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--cf-text-tertiary)'}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ── TAB: Plan ── */}
        {activeTab === 'plan' && (
          <motion.div key="plan" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {/* Plan actual */}
            <div className="cf-card" style={{ padding: '24px 28px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-navy)', marginBottom: 16 }}>
                Tu plan actual
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '16px 20px', borderRadius: 12,
                background: 'var(--cf-bg-subtle)',
                border: `2px solid ${planActual.color}30`,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: planActual.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, color: '#fff', flexShrink: 0,
                }}>
                  💳
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: planActual.color }}>
                    Plan {planActual.label}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--cf-text-tertiary)' }}>
                    {planActual.precio === '$0' ? 'Gratis para siempre' : `${planActual.precio} MXN / mes`}
                  </div>
                </div>
                {activePlan === 'free' && (
                  <span style={{
                    fontSize: 11, padding: '4px 12px', borderRadius: 20,
                    background: '#E6F1FB', color: '#185FA5', fontWeight: 600,
                  }}>
                    Actualiza para más funciones
                  </span>
                )}
              </div>
            </div>

            {/* Planes disponibles */}
            <div className="cf-card" style={{ padding: '24px 28px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-navy)', marginBottom: 16 }}>
                Planes disponibles
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {Object.entries(PLAN_CONFIG).map(([key, plan]) => (
                  <div
                    key={key}
                    style={{
                      padding: '16px', borderRadius: 12,
                      border: `2px solid ${activePlan === key ? plan.color : 'var(--cf-border)'}`,
                      background: activePlan === key ? `${plan.color}10` : 'var(--cf-bg)',
                      position: 'relative',
                    }}
                  >
                    {activePlan === key && (
                      <div style={{
                        position: 'absolute', top: -10, right: 12,
                        fontSize: 10, fontWeight: 700, padding: '2px 10px',
                        borderRadius: 20, background: plan.color, color: '#fff',
                      }}>
                        Actual
                      </div>
                    )}
                    {key === 'pyme' && activePlan !== 'pyme' && (
                      <div style={{
                        position: 'absolute', top: -10, right: 12,
                        fontSize: 10, fontWeight: 700, padding: '2px 10px',
                        borderRadius: 20, background: '#185FA5', color: '#fff',
                      }}>
                        Más popular
                      </div>
                    )}
                    <div style={{ fontSize: 15, fontWeight: 700, color: plan.color, marginBottom: 4 }}>
                      {plan.label}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--cf-text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {plan.precio}
                      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--cf-text-tertiary)', fontFamily: 'var(--font-sans)' }}>
                        {plan.precio !== '$0' ? ' MXN/mes' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: 16, padding: '14px 16px', borderRadius: 10,
                background: 'var(--cf-bg-subtle)', fontSize: 13,
                color: 'var(--cf-text-tertiary)', lineHeight: 1.6,
              }}>
                💡 Los upgrades de plan estarán disponibles próximamente con pago via Stripe. Por ahora tu cuenta está en modo beta gratuito.
              </div>
            </div>

            {/* Datos de facturación */}
            <div className="cf-card" style={{ padding: '24px 28px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-navy)', marginBottom: 4 }}>
                Facturación de ContaFácil
              </div>
              <p style={{ fontSize: 13, color: 'var(--cf-text-tertiary)', marginBottom: 16, lineHeight: 1.6 }}>
                Cuando actives un plan de pago, ContaFácil te emitirá automáticamente un CFDI 4.0 cada mes a nombre de tu empresa. Así puedes deducir tu suscripción como gasto.
              </p>
              <div style={{
                padding: '12px 16px', borderRadius: 10,
                background: 'var(--cf-green-light)',
                border: '1px solid #97C45930',
                fontSize: 13, color: '#27500A',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 18 }}>🧾</span>
                Factura automática incluida en todos los planes de pago — deducible de impuestos
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}

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
