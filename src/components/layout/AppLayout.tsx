import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { getInitials } from '@/lib/utils'

const NAV_ITEMS = [
  { path: '/dashboard',     icon: '◉',  label: 'Inicio',               shortLabel: 'Inicio' },
  { path: '/ingresos',      icon: '↑',  label: '¿Cuánto entró?',       shortLabel: 'Ingresos' },
  { path: '/egresos',       icon: '↓',  label: '¿Cuánto salió?',       shortLabel: 'Egresos' },
  { path: '/sat',           icon: '🏛', label: '¿Qué le debo al SAT?', shortLabel: 'SAT' },
  { path: '/reportes',      icon: '📊', label: 'Reportes',             shortLabel: 'Reportes' },
  { path: '/conta',         icon: '🤖', label: 'Conta IA',             shortLabel: 'Conta' },
  { path: '/configuracion', icon: '⚙️', label: 'Configuración',        shortLabel: 'Config' },
]

const BOTTOM_NAV = NAV_ITEMS.slice(0, 5)

type ScreenSize = 'mobile' | 'tablet' | 'laptop' | 'desktop' | 'wide'

function useScreenSize(): ScreenSize {
  const [size, setSize] = useState<ScreenSize>('desktop')
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      if (w < 640) setSize('mobile')
      else if (w < 1024) setSize('tablet')
      else if (w < 1280) setSize('laptop')
      else if (w < 2560) setSize('desktop')
      else setSize('wide')
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return size
}

export default function AppLayout() {
  const { user, activeOrg, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const screen = useScreenSize()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const isMobile = screen === 'mobile'
  const isRail = screen === 'tablet'
  const isWide = screen === 'wide'
  const sidebarWidth = isRail ? 64 : isWide ? 280 : 240
  const iniciales = getInitials(activeOrg?.name ?? user?.email ?? 'U')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    clearAuth()
    navigate('/login')
  }

  useEffect(() => {
    setShowUserMenu(false)
  }, [location.pathname])

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: 'var(--cf-bg)',
      fontFamily: 'var(--font-sans)',
    }}>

      {/* ── Sidebar (tablet + desktop + wide) ── */}
      {!isMobile && (
        <aside style={{
          width: sidebarWidth, flexShrink: 0,
          background: 'var(--cf-bg-card)',
          borderRight: '1px solid var(--cf-border)',
          display: 'flex', flexDirection: 'column',
          position: 'sticky', top: 0, height: '100vh',
          overflowY: 'auto', overflowX: 'hidden',
          zIndex: 10,
        }}>

          {/* Logo */}
          <div style={{
            padding: isRail ? '16px 0' : '20px 16px 16px',
            borderBottom: '1px solid var(--cf-border)',
            display: 'flex', alignItems: 'center',
            justifyContent: isRail ? 'center' : 'flex-start',
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
              {!isRail && (
                <div>
                  <div style={{ fontSize: isWide ? 16 : 15, fontWeight: 700, color: 'var(--cf-navy)', lineHeight: 1.2 }}>ContaFácil</div>
                  <div style={{ fontSize: 10, color: 'var(--cf-text-tertiary)', lineHeight: 1.2 }}>by MMV Digital</div>
                </div>
              )}
            </NavLink>
          </div>

          {/* Org activa */}
          {!isRail && activeOrg && (
            <div style={{
              margin: '10px 10px 0', padding: '8px 10px',
              background: 'var(--cf-bg-subtle)', borderRadius: 8,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cf-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeOrg.name}
              </div>
              {activeOrg.rfc && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cf-text-tertiary)', marginTop: 1 }}>
                  {activeOrg.rfc}
                </div>
              )}
            </div>
          )}

          {/* Navegación */}
          <nav style={{ flex: 1, padding: isRail ? '12px 8px' : '12px 10px' }}>
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                title={isRail ? item.label : undefined}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center',
                  justifyContent: isRail ? 'center' : 'flex-start',
                  gap: isRail ? 0 : 10,
                  padding: isRail ? '11px 0' : '9px 12px',
                  borderRadius: 8, fontSize: isWide ? 14 : 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--cf-navy)' : 'var(--cf-text-secondary)',
                  background: isActive ? 'var(--cf-blue-light)' : 'transparent',
                  textDecoration: 'none', marginBottom: 2,
                  transition: 'all 0.15s',
                })}
              >
                <span style={{ fontSize: 16, width: isRail ? 24 : 20, textAlign: 'center', flexShrink: 0 }}>
                  {item.icon}
                </span>
                {!isRail && <span style={{ lineHeight: 1.3 }}>{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          {/* Usuario */}
          <div style={{
            padding: isRail ? '12px 8px' : '12px 10px',
            borderTop: '1px solid var(--cf-border)',
            position: 'relative',
          }}>
            <button
              onClick={() => setShowUserMenu(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: isRail ? 'center' : 'flex-start',
                gap: isRail ? 0 : 10,
                padding: isRail ? '6px 0' : '8px 10px',
                borderRadius: 8, background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left',
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
              {!isRail && (
                <>
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
                </>
              )}
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  style={{
                    position: 'absolute', bottom: '100%', left: 10, right: 10,
                    background: 'var(--cf-bg-card)', border: '1px solid var(--cf-border)',
                    borderRadius: 10, overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginBottom: 4, zIndex: 50,
                  }}
                >
                  <div style={{ padding: '10px 16px 8px', borderBottom: '1px solid var(--cf-border)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cf-text-primary)' }}>{activeOrg?.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--cf-text-tertiary)' }}>{user?.email}</div>
                  </div>
                  <button
                    onClick={() => { navigate('/configuracion'); setShowUserMenu(false) }}
                    style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', fontSize: 13, color: 'var(--cf-text-secondary)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)' }}
                  >
                    ⚙️ Configuración
                  </button>
                  <button
                    onClick={handleLogout}
                    style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', fontSize: 13, color: 'var(--cf-red)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)', borderTop: '1px solid var(--cf-border)' }}
                  >
                    Cerrar sesión
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </aside>
      )}

      {/* ── Main content ── */}
      <main style={{
        flex: 1, minWidth: 0,
        padding: isMobile ? '16px 16px 88px' : isRail ? '20px' : isWide ? '36px 48px' : '28px 32px',
        overflowY: 'auto',
      }}>

        {/* Topbar móvil */}
        {isMobile && (
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16, paddingBottom: 16,
            borderBottom: '1px solid var(--cf-border)',
          }}>
            <NavLink to="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--cf-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                🧾
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-navy)' }}>ContaFácil</div>
                <div style={{ fontSize: 9, color: 'var(--cf-text-tertiary)' }}>by MMV Digital</div>
              </div>
            </NavLink>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {activeOrg && (
                <div style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'var(--cf-bg-subtle)', color: 'var(--cf-text-secondary)', border: '1px solid var(--cf-border)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeOrg.name}
                </div>
              )}
              <button
                onClick={() => navigate('/conta')}
                style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, #185FA5, #1D9E75)', border: 'none', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Conta IA"
              >
                🤖
              </button>
              <button
                onClick={() => navigate('/configuracion')}
                style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--cf-bg-subtle)', border: '1px solid var(--cf-border)', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Configuración"
              >
                ⚙️
              </button>
            </div>
          </div>
        )}

        <Outlet />
      </main>

      {/* ── Bottom nav móvil ── */}
      {isMobile && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--cf-bg-card)',
          borderTop: '1px solid var(--cf-border)',
          padding: '6px 4px 16px',
          display: 'flex', justifyContent: 'space-around', alignItems: 'center',
          zIndex: 100, boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
        }}>
          {BOTTOM_NAV.map(item => {
            const isActive = location.pathname === item.path
            return (
              <NavLink
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  textDecoration: 'none', padding: '6px 10px', borderRadius: 10,
                  minWidth: 54, background: isActive ? 'var(--cf-blue-light)' : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--cf-navy)' : 'var(--cf-text-tertiary)', lineHeight: 1.2 }}>
                  {item.shortLabel}
                </span>
              </NavLink>
            )
          })}
        </nav>
      )}

    </div>
  )
}
