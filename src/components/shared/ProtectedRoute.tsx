import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

interface Props {
  requireOrg?: boolean
}

export default function ProtectedRoute({ requireOrg = true }: Props) {
  const { user, isLoading, activeOrg } = useAuthStore()

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--cf-bg)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '3px solid var(--cf-green)',
            borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px'
          }} />
          <p style={{ color: 'var(--cf-text-tertiary)', fontSize: 14 }}>
            Cargando ContaFácil...
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (requireOrg && !activeOrg) return <Navigate to="/onboarding" replace />

  return <Outlet />
}