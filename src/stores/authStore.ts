import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Session } from '@supabase/supabase-js'
import type { Organization, OrgMember, UserRole, PlanType } from '@/types'

interface AuthState {
  // Auth
  user: User | null
  session: Session | null
  isLoading: boolean

  // Organización activa (workspace switcher)
  activeOrg: Organization | null
  activeRole: UserRole | null
  activePlan: PlanType | null
  userOrgs: Organization[]
  userMember: OrgMember | null

  // Acciones
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
  setActiveOrg: (org: Organization, role: UserRole, plan: PlanType) => void
  setUserOrgs: (orgs: Organization[]) => void
  setUserMember: (member: OrgMember | null) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isLoading: true,
      activeOrg: null,
      activeRole: null,
      activePlan: null,
      userOrgs: [],
      userMember: null,

      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setLoading: (isLoading) => set({ isLoading }),

      setActiveOrg: (org, role, plan) => set({
        activeOrg: org,
        activeRole: role,
        activePlan: plan,
      }),

      setUserOrgs: (userOrgs) => set({ userOrgs }),
      setUserMember: (userMember) => set({ userMember }),

      clearAuth: () => set({
        user: null,
        session: null,
        activeOrg: null,
        activeRole: null,
        activePlan: null,
        userOrgs: [],
        userMember: null,
      }),
    }),
    {
      name: 'cf-auth',
      partialize: (state) => ({
        activeOrg: state.activeOrg,
        activeRole: state.activeRole,
        activePlan: state.activePlan,
      }),
    }
  )
)

// ─── Helpers de permisos ──────────────────────────────────────────
export const canEdit = (role: UserRole | null) =>
  role !== null && ['owner', 'admin', 'contador'].includes(role)

export const canCreate = (role: UserRole | null) =>
  role !== null && ['owner', 'admin', 'empleado'].includes(role)

export const canAdmin = (role: UserRole | null) =>
  role !== null && ['owner', 'admin'].includes(role)

export const isOwner = (role: UserRole | null) => role === 'owner'
