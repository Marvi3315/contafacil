import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { validarRFC } from '@/lib/utils'

type Step = 'email' | 'sent' | 'error'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<Step>('email')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsLoading(true)
    setErrorMsg('')

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          shouldCreateUser: true,
        }
      })

      if (error) throw error
      setStep('sent')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ocurrió un error inesperado'
      setErrorMsg(message)
      setStep('error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--cf-bg)',
      fontFamily: 'var(--font-sans)',
      padding: '20px',
    }}>

      {/* Fondo decorativo */}
      <div style={{
        position: 'fixed', inset: 0, overflow: 'hidden',
        pointerEvents: 'none', zIndex: 0,
      }}>
        <div style={{
          position: 'absolute', top: '-20%', right: '-10%',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(29,158,117,0.06) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', left: '-10%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(24,95,165,0.06) 0%, transparent 70%)',
        }} />
      </div>

      {/* Card principal */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{
          position: 'relative', zIndex: 1,
          background: 'var(--cf-bg-card)',
          border: '1px solid var(--cf-border)',
          borderRadius: 20,
          padding: '48px 40px',
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        }}
      >
        {/* Logo + título */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #0D1B2A 0%, #185FA5 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 24,
          }}>
            🧾
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 700,
            color: 'var(--cf-navy)', margin: '0 0 6px',
            letterSpacing: '-0.5px',
          }}>
            ContaFácil
          </h1>
          <p style={{
            fontSize: 13, color: 'var(--cf-text-tertiary)',
            margin: 0, lineHeight: 1.5,
          }}>
            Tan fácil que hasta tu abuelita lleva sus cuentas
          </p>
          <div style={{
            display: 'inline-block', marginTop: 10,
            fontSize: 10, fontWeight: 500,
            color: 'var(--cf-blue)', letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            by MMV Digital
          </div>
        </div>

        {/* Contenido según paso */}
        <AnimatePresence mode="wait">

          {/* PASO: ingresar email */}
          {step === 'email' && (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.25 }}
            >
              <p style={{
                fontSize: 14, color: 'var(--cf-text-secondary)',
                textAlign: 'center', marginBottom: 24, lineHeight: 1.6,
              }}>
                Ingresa tu correo y te enviamos un link para entrar.<br />
                <span style={{ color: 'var(--cf-text-tertiary)', fontSize: 13 }}>
                  Sin contraseñas, sin complicaciones.
                </span>
              </p>

              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{
                    display: 'block', fontSize: 13, fontWeight: 500,
                    color: 'var(--cf-text-secondary)', marginBottom: 8,
                  }}>
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    required
                    disabled={isLoading}
                    style={{
                      width: '100%', padding: '12px 16px',
                      fontSize: 15, borderRadius: 10,
                      border: '1.5px solid var(--cf-border)',
                      background: 'var(--cf-bg)',
                      color: 'var(--cf-text-primary)',
                      outline: 'none', transition: 'border-color 0.2s',
                      fontFamily: 'var(--font-sans)',
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--cf-green)'}
                    onBlur={e => e.target.style.borderColor = 'var(--cf-border)'}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  style={{
                    width: '100%', padding: '13px 24px',
                    fontSize: 15, fontWeight: 600,
                    borderRadius: 10, border: 'none',
                    background: isLoading || !email.trim()
                      ? 'var(--cf-bg-subtle)'
                      : 'var(--cf-navy)',
                    color: isLoading || !email.trim()
                      ? 'var(--cf-text-tertiary)'
                      : '#ffffff',
                    cursor: isLoading || !email.trim() ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'var(--font-sans)',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 8,
                  }}
                >
                  {isLoading ? (
                    <>
                      <span style={{
                        width: 16, height: 16, borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff',
                        animation: 'spin 0.7s linear infinite',
                        display: 'inline-block',
                      }} />
                      Enviando...
                    </>
                  ) : (
                    '✉️ Enviar link de acceso'
                  )}
                </button>
              </form>

              {/* Divisor */}
              <div style={{
                display: 'flex', alignItems: 'center',
                gap: 12, margin: '24px 0',
              }}>
                <div style={{ flex: 1, height: 1, background: 'var(--cf-border)' }} />
                <span style={{ fontSize: 12, color: 'var(--cf-text-tertiary)' }}>o</span>
                <div style={{ flex: 1, height: 1, background: 'var(--cf-border)' }} />
              </div>

              {/* Google OAuth (preparado para activar) */}
              <button
                onClick={async () => {
                  await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: `${window.location.origin}/dashboard` }
                  })
                }}
                style={{
                  width: '100%', padding: '12px 24px',
                  fontSize: 14, fontWeight: 500,
                  borderRadius: 10,
                  border: '1.5px solid var(--cf-border)',
                  background: 'var(--cf-bg-card)',
                  color: 'var(--cf-text-primary)',
                  cursor: 'pointer', transition: 'all 0.2s',
                  fontFamily: 'var(--font-sans)',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 10,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--cf-bg-subtle)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--cf-bg-card)')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuar con Google
              </button>
            </motion.div>
          )}

          {/* PASO: link enviado */}
          {step === 'sent' && (
            <motion.div
              key="sent"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ textAlign: 'center' }}
            >
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--cf-green-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', fontSize: 28,
              }}>
                ✉️
              </div>
              <h2 style={{
                fontSize: 18, fontWeight: 700,
                color: 'var(--cf-navy)', marginBottom: 10,
              }}>
                ¡Revisa tu correo!
              </h2>
              <p style={{
                fontSize: 14, color: 'var(--cf-text-secondary)',
                lineHeight: 1.7, marginBottom: 8,
              }}>
                Te enviamos un link mágico a:
              </p>
              <div style={{
                background: 'var(--cf-bg-subtle)',
                border: '1px solid var(--cf-border)',
                borderRadius: 8, padding: '8px 16px',
                fontSize: 14, fontWeight: 600,
                color: 'var(--cf-navy)', marginBottom: 20,
                fontFamily: 'var(--font-mono)',
              }}>
                {email}
              </div>
              <p style={{
                fontSize: 13, color: 'var(--cf-text-tertiary)', lineHeight: 1.6,
              }}>
                Haz click en el link del correo para entrar.<br />
                El link expira en 60 minutos.
              </p>
              <button
                onClick={() => { setStep('email'); setEmail('') }}
                style={{
                  marginTop: 24, background: 'none', border: 'none',
                  color: 'var(--cf-blue)', cursor: 'pointer',
                  fontSize: 13, fontFamily: 'var(--font-sans)',
                  textDecoration: 'underline',
                }}
              >
                Usar otro correo
              </button>
            </motion.div>
          )}

          {/* PASO: error */}
          {step === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ textAlign: 'center' }}
            >
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--cf-red-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', fontSize: 28,
              }}>
                ⚠️
              </div>
              <h2 style={{
                fontSize: 18, fontWeight: 700,
                color: 'var(--cf-navy)', marginBottom: 10,
              }}>
                Algo salió mal
              </h2>
              <p style={{
                fontSize: 13, color: 'var(--cf-red)',
                background: 'var(--cf-red-light)',
                border: '1px solid var(--cf-red)',
                borderRadius: 8, padding: '10px 16px',
                marginBottom: 20, lineHeight: 1.5,
              }}>
                {errorMsg}
              </p>
              <button
                onClick={() => setStep('email')}
                style={{
                  padding: '11px 28px', borderRadius: 10,
                  border: 'none', background: 'var(--cf-navy)',
                  color: '#fff', cursor: 'pointer',
                  fontSize: 14, fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Intentar de nuevo
              </button>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Footer legal */}
        <p style={{
          marginTop: 32, fontSize: 11,
          color: 'var(--cf-text-tertiary)',
          textAlign: 'center', lineHeight: 1.6,
        }}>
          Al continuar aceptas nuestros{' '}
          <a href="/terminos" style={{ color: 'var(--cf-blue)', textDecoration: 'none' }}>
            Términos de Uso
          </a>{' '}
          y{' '}
          <a href="/privacidad" style={{ color: 'var(--cf-blue)', textDecoration: 'none' }}>
            Aviso de Privacidad
          </a>
        </p>
      </motion.div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: var(--cf-text-tertiary); }
      `}</style>
    </div>
  )
}
