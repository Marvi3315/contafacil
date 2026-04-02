import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export default function PublicRoute() {
  const { user, isLoading, activeOrg } = useAuthStore()

  if (isLoading) return null

  if (user) {
    return <Navigate to={activeOrg ? '/dashboard' : '/onboarding'} replace />
  }

  return <Outlet />
}