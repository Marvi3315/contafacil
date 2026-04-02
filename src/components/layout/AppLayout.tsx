import { Outlet } from 'react-router-dom'

export default function AppLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--cf-bg)' }}>
      <aside style={{
        width: 220, background: 'var(--cf-bg-card)',
        borderRight: '1px solid var(--cf-border)',
        display: 'flex', flexDirection: 'column', padding: '20px 0'
      }}>
        <div style={{ padding: '0 16px 20px', borderBottom: '1px solid var(--cf-border)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--cf-navy)' }}>
            ContaFácil
          </div>
          <div style={{ fontSize: 11, color: 'var(--cf-text-tertiary)' }}>
            by MMV Digital
          </div>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}