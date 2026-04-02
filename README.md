# ContaFácil 🧾

> "Tan fácil que hasta tu abuelita lleva sus cuentas"

**ContaFácil** es un SaaS de contabilidad moderno para PyMEs mexicanas, diseñado para personas sin conocimientos contables. Sin tecnicismos, con inteligencia artificial integrada, y 100% legal ante el SAT.

**Desarrollado por:** Moisés Martínez Virgen — [MMV Digital](https://mmvdigital.com)  
**© 2026 Todos los derechos reservados**

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + Vite 6 + TypeScript 5 |
| Estilos | TailwindCSS v4 + Framer Motion |
| Estado | Zustand + React Query v5 |
| Forms | React Hook Form + Zod |
| Backend | Supabase (PostgreSQL + RLS + Edge Functions) |
| Auth | Supabase Auth (Magic Link + OAuth) |
| Pagos | Stripe Billing |
| Emails | Resend |
| Notificaciones | Twilio WhatsApp |
| IA | Claude Sonnet (Anthropic) vía tool_use |
| Deploy | Vercel |
| PWA | vite-plugin-pwa |

---

## Inicio rápido

```bash
# 1. Clonar el repo
git clone https://github.com/Marvi3315/contafacil.git
cd contafacil

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Edita .env con tus credenciales de Supabase

# 4. Ejecutar en desarrollo
npm run dev
```

## Estructura del proyecto

```
src/
├── components/     # Componentes reutilizables
│   ├── ui/        # Botones, inputs, modales base
│   ├── layout/    # Sidebar, Topbar, BottomNav
│   └── shared/    # Guards, loaders, toasts
├── features/       # Módulos por funcionalidad
│   ├── auth/      # Login, onboarding
│   ├── dashboard/ # Dashboard + semáforo
│   ├── transactions/ # Ingresos y egresos
│   ├── taxes/     # Módulo SAT
│   ├── reports/   # Reportes exportables
│   ├── conta-ai/  # Agente IA "Conta"
│   └── settings/  # Configuración
├── hooks/          # Custom hooks
├── lib/            # Supabase, utils, stripe
├── stores/         # Zustand stores
└── types/          # TypeScript types globales

supabase/
└── migrations/     # Schema SQL
```

## Planes disponibles

| Plan | Precio | Usuarios | Para quién |
|------|--------|----------|-----------|
| Gratis | $0/mes | 1 | Probar el sistema |
| Emprendedor | $299 MXN/mes | 2 | Freelancers, RESICO |
| PyME | $599 MXN/mes | 5 | Negocios con equipo |
| Agencia | $1,499 MXN/mes | Ilimitados | Despachos contables |

## Seguridad

- OWASP Top 10 compliance
- Row Level Security (RLS) en todas las tablas
- Cifrado AES-256 para datos sensibles
- Audit log inmutable (append-only)
- 2FA/MFA para roles críticos
- LFPDPPP 2026 compliant

## Licencia

Propietario — © 2026 Moisés Martínez Virgen / MMV Digital  
Todos los derechos reservados. Prohibida la reproducción sin autorización escrita.
