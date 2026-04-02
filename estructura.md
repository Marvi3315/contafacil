contafacil/
├── public/
│   ├── favicon.ico
│   └── logo.svg
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── ui/              # componentes base reutilizables
│   │   ├── layout/          # Sidebar, Topbar, BottomNav
│   │   └── shared/          # modales, toasts, loaders
│   ├── features/            # módulos por feature
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── categories/
│   │   ├── taxes/
│   │   ├── reports/
│   │   ├── conta-ai/
│   │   └── settings/
│   ├── hooks/               # custom hooks
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── stripe.ts
│   │   └── utils.ts
│   ├── stores/              # zustand stores
│   ├── types/               # typescript types globales
│   ├── router/              # react router v7
│   └── styles/
│       └── globals.css
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
