import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { getInitials } from '@/lib/utils'

const NAV_ITEMS = [
  { path: '/dashboard',     icon: '◉',  label: 'Inicio' },
  { path: '/ingresos',      icon: '↑',  label: '¿Cuánto entró?' },
  { path: '/egresos',       icon: '↓',  label: '¿Cuánto salió?' },
  { path: '/sat',           icon: '🏛', label: '¿Qué le debo al SAT?' },
  { path: '/reportes',      icon: '📊', label: 'Reportes' },
  { path: '/conta',         icon: '🤖', label: 'Conta IA' },
  { path: '/configuracion', icon: '⚙️', label: 'Configuración' },
]

export default function AppLayout() {
  const { user, activeOrg, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    clearAuth()
    navigate('/login')
  }

  const iniciales = getInitials(activeOrg?.name ?? user?.email ?? 'U')

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: 'var(--cf-bg)',
      fontFamily: 'var(--font-sans)',
    }}>

      {/* ── Sidebar desktop ── */}
      <aside style={{
        width: 240, flexShrink: 0,
        background: 'var(--cf-bg-card)',
        borderRight: '1px solid var(--cf-border)',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh',
        overflowY: 'auto',
      }}>

        {/* Logo */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--cf-border)',
        }}>
          <NavLink to="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--cf-navy)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>
              🧾
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-navy)', lineHeight: 1.2 }}>
                ContaFácil
              </div>
              <div style={{ fontSize: 10, color: 'var(--cf-text-tertiary)', lineHeight: 1.2 }}>
                by MMV Digital
              </div>
            </div>
          </NavLink>

          {/* Org activa */}
          {activeOrg && (
            <div style={{
              marginTop: 12, padding: '8px 10px',
              background: 'var(--cf-bg-subtle)',
              borderRadius: 8, fontSize: 12,
              color: 'var(--cf-text-secondary)',
            }}>
              <div style={{ fontWeight: 600, color: 'var(--cf-text-primary)', fontSize: 12 }}>
                {activeOrg.name}
              </div>
              {activeOrg.rfc && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cf-text-tertiary)', marginTop: 1 }}>
                  {activeOrg.rfc}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navegación */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8,
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--cf-navy)' : 'var(--cf-text-secondary)',
                background: isActive ? 'var(--cf-blue-light)' : 'transparent',
                textDecoration: 'none', marginBottom: 2,
                transition: 'all 0.15s',
              })}
            >
              <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>
                {item.icon}
              </span>
              <span style={{ lineHeight: 1.3 }}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Usuario */}
        <div style={{
          padding: '12px 10px',
          borderTop: '1px solid var(--cf-border)',
          position: 'relative',
        }}>
          <button
            onClick={() => setShowUserMenu(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--cf-navy)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {iniciales}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cf-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeOrg?.name ?? 'Mi cuenta'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--cf-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </div>
            </div>
            <span style={{ color: 'var(--cf-text-tertiary)', fontSize: 10 }}>
              {showUserMenu ? '▲' : '▼'}
            </span>
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                style={{
                  position: 'absolute', bottom: '100%', left: 10, right: 10,
                  background: 'var(--cf-bg-card)',
                  border: '1px solid var(--cf-border)',
                  borderRadius: 10, overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  marginBottom: 4,
                }}
              >
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%', padding: '11px 16px',
                    background: 'none', border: 'none',
                    fontSize: 13, color: 'var(--cf-red)',
                    cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Cerrar sesión
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <main style={{
        flex: 1, padding: '28px 32px',
        overflowY: 'auto', minWidth: 0,
      }}>
        <Outlet />
      </main>

      {/* ── Bottom nav móvil (≤768px) ── */}
      <style>{`
        @media (max-width: 768px) {
          aside { display: none !important; }
          main { padding: 16px 16px 80px !important; }
          .bottom-nav { display: flex !important; }
        }
        @media (min-width: 769px) {
          .bottom-nav { display: none !important; }
        }
      `}</style>

      <nav className="bottom-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--cf-bg-card)',
        borderTop: '1px solid var(--cf-border)',
        padding: '8px 0 12px',
        justifyContent: 'space-around',
        zIndex: 100,
      }}>
        {NAV_ITEMS.slice(0, 5).map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 2,
              fontSize: 18, textDecoration: 'none',
              color: isActive ? 'var(--cf-navy)' : 'var(--cf-text-tertiary)',
              minWidth: 44,
            })}
          >
            <span>{item.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 500 }}>
              {item.label.split(' ')[0]}
            </span>
          </NavLink>
        ))}
      </nav>

    </div>
  )
}
