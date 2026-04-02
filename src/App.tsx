import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

// Layouts
import AppLayout from '@/components/layout/AppLayout'

// Auth pages
import LoginPage from '@/features/auth/LoginPage'
import OnboardingPage from '@/features/auth/OnboardingPage'

// App pages
import DashboardPage from '@/features/dashboard/DashboardPage'
import TransactionsPage from '@/features/transactions/TransactionsPage'
import TaxesPage from '@/features/taxes/TaxesPage'
import ReportsPage from '@/features/reports/ReportsPage'
import ContaAIPage from '@/features/conta-ai/ContaAIPage'
import SettingsPage from '@/features/settings/SettingsPage'

// Guards
import ProtectedRoute from '@/components/shared/ProtectedRoute'
import PublicRoute from '@/components/shared/PublicRoute'

export default function App() {
  const { setUser, setSession, setLoading } = useAuthStore()

  useEffect(() => {
    // Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    // Cargar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [setUser, setSession, setLoading])

  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas públicas */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Onboarding (requiere auth pero no org) */}
        <Route element={<ProtectedRoute requireOrg={false} />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Route>

        {/* Rutas protegidas (requieren auth + org) */}
        <Route element={<ProtectedRoute requireOrg={true} />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/ingresos" element={<TransactionsPage type="ingreso" />} />
            <Route path="/egresos" element={<TransactionsPage type="egreso" />} />
            <Route path="/sat" element={<TaxesPage />} />
            <Route path="/reportes" element={<ReportsPage />} />
            <Route path="/conta" element={<ContaAIPage />} />
            <Route path="/configuracion" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
