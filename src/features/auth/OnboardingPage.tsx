// ═══════════════════════════════════════════════════════════
//  OnboardingPage.tsx — Con RFC Lookup al SAT
//  ContaFácil / DeclaraYa — MMV Digital © 2026
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useRFCLookup } from '@/hooks/useRFCLookup'
import type { RFCData } from '@/services/rfcService'

interface OrgData {
  name: string; rfc: string; regimen_fiscal: string; regimen_code: string
  categoria_ejemplo: string; razon_social: string; tipo_persona: string; codigo_postal: string
}

const REGIMENES = [
  { code: '621', label: 'RESICO', desc: 'Régimen Simplificado de Confianza – para ingresos menores a $3.5M al año', icon: '⚡' },
  { code: '612', label: 'Actividad Empresarial', desc: 'Persona física con actividad empresarial y profesional', icon: '💼' },
  { code: '601', label: 'General de Ley (PM)', desc: 'Persona moral – empresas formales S.A. de C.V., S. de R.L.', icon: '🏢' },
  { code: '606', label: 'Arrendamiento', desc: 'Ingresos por renta de inmuebles', icon: '🏠' },
  { code: '625', label: 'Plataformas Tecnológicas', desc: 'Uber, Airbnb, Rappi y similares', icon: '📱' },
  { code: '616', label: 'Sin obligaciones fiscales', desc: 'Solo para uso personal sin actividad económica', icon: '👤' },
]

const CATEGORIAS_EJEMPLO = [
  { value: 'servicios',    label: 'Servicios / Consultoría', icon: '💼' },
  { value: 'comercio',     label: 'Venta de productos',       icon: '🛍️' },
  { value: 'restaurante',  label: 'Restaurante / Comida',     icon: '🍽️' },
  { value: 'construccion', label: 'Construcción / Obra',      icon: '🏗️' },
  { value: 'tecnologia',   label: 'Tecnología / Software',    icon: '💻' },
  { value: 'salud',        label: 'Salud / Médico',           icon: '🏥' },
  { value: 'educacion',    label: 'Educación / Cursos',       icon: '📚' },
  { value: 'otro',         label: 'Otro giro',                icon: '✨' },
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user, setActiveOrg } = useAuthStore()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<OrgData>({
    name: '', rfc: '', regimen_fiscal: '', regimen_code: '',
    categoria_ejemplo: '', razon_social: '', tipo_persona: '', codigo_postal: '',
  })
  const totalSteps = 5

  const { rfc, rfcData, status: rfcStatus, errorMsg: rfcError, handleRFCChange } = useRFCLookup(
    (satData: RFCData) => {
      setData(d => ({
        ...d,
        rfc: satData.rfc, razon_social: satData.razon_social,
        tipo_persona: satData.tipo_persona, codigo_postal: satData.codigo_postal,
        regimen_fiscal: satData.regimen_fiscal || d.regimen_fiscal,
        regimen_code: satData.regimen_code || d.regimen_code,
        name: d.name || satData.razon_social,
      }))
    }
  )

  const handleRFC = (value: string) => {
    handleRFCChange(value)
    setData(d => ({ ...d, rfc: value.toUpperCase().replace(/[^A-Z0-9Ñ&]/g, '') }))
  }

  const handleFinish = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const { data: result, error } = await supabase.rpc('setup_organization', {
        p_name: data.name, p_rfc: rfc || null,
        p_regimen_fiscal: data.regimen_fiscal || null, p_regimen_code: data.regimen_code || null,
      })
      if (error) throw error
      if (rfcData) {
        await supabase.from('profiles').upsert({
          id: user.id, rfc: rfcData.rfc,
          rfc_verified: rfcData.sat_status === 'activo',
          razon_social: rfcData.razon_social, regimen_fiscal: rfcData.regimen_fiscal,
          tipo_persona: rfcData.tipo_persona, codigo_postal_fiscal: rfcData.codigo_postal,
          sat_status: rfcData.sat_status, rfc_verified_at: new Date().toISOString(),
        })
      }
      const { data: org, error: orgError } = await supabase
        .from('organizations').select('*').eq('id', result.org_id).single()
      if (orgError) throw orgError
      setActiveOrg(org, 'owner', 'free')
      navigate('/dashboard')
    } catch (err) { console.error('Error en onboarding:', err) }
    finally { setIsLoading(false) }
  }

  const canNext = () => {
    if (step === 1) return data.name.trim().length >= 2
    if (step === 2) return true
    if (step === 3) return data.regimen_code !== ''
    if (step === 4) return data.categoria_ejemplo !== ''
    return true
  }

  const rfcBorderColor = () => {
    if (rfcStatus === 'found') return 'var(--cf-green)'
    if (rfcStatus === 'not_found' || rfcStatus === 'error') return 'var(--cf-red)'
    if (rfcStatus === 'loading') return 'var(--cf-blue)'
    return 'var(--cf-border)'
  }

  const rfcStatusIcon = () => {
    if (rfcStatus === 'found') return '✅'
    if (rfcStatus === 'not_found') return '❌'
    if (rfcStatus === 'error') return '⚠️'
    return null
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--cf-bg)', fontFamily: 'var(--font-sans)', padding: 20,
    }}>
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🧾</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--cf-navy)' }}>ContaFácil</div>
        <div style={{ fontSize: 12, color: 'var(--cf-text-tertiary)' }}>Configuremos tu cuenta en 3 minutos</div>
      </motion.div>

      <div style={{ width: '100%', maxWidth: 520, marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600,
                background: i+1 < step ? 'var(--cf-green)' : i+1 === step ? 'var(--cf-navy)' : 'var(--cf-bg-subtle)',
                color: i+1 <= step ? '#fff' : 'var(--cf-text-tertiary)', transition: 'all 0.3s',
              }}>
                {i+1 < step ? '✓' : i+1}
              </div>
            </div>
          ))}
        </div>
        <div style={{ height: 4, background: 'var(--cf-bg-subtle)', borderRadius: 2, overflow: 'hidden' }}>
          <motion.div animate={{ width: `${((step-1)/(totalSteps-1))*100}%` }} transition={{ duration: 0.4 }}
            style={{ height: '100%', background: 'var(--cf-green)', borderRadius: 2 }} />
        </div>
      </div>

      <div style={{
        width: '100%', maxWidth: 520, background: 'var(--cf-bg-card)',
        border: '1px solid var(--cf-border)', borderRadius: 20, padding: '36px 40px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.07)',
      }}>
        <AnimatePresence mode="wait">

          {step === 1 && (
            <motion.div key="step1" initial={{ opacity:0,x:30 }} animate={{ opacity:1,x:0 }}
              exit={{ opacity:0,x:-30 }} transition={{ duration:0.25 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>👋</div>
              <h2 style={{ fontSize:20, fontWeight:700, color:'var(--cf-navy)', marginBottom:6 }}>¿Cómo se llama tu negocio?</h2>
              <p style={{ fontSize:14, color:'var(--cf-text-tertiary)', marginBottom:28, lineHeight:1.6 }}>
                Puede ser tu nombre, el nombre de tu empresa o tu marca. Lo puedes cambiar después.
              </p>
              <label style={{ fontSize:13, fontWeight:500, color:'var(--cf-text-secondary)', display:'block', marginBottom:8 }}>Nombre del negocio</label>
              <input type="text" value={data.name} onChange={e => setData(d => ({ ...d, name: e.target.value }))}
                placeholder="Ej: MMV Digital, Tacos El Güero, Clínica Salud..." autoFocus
                style={{
                  width:'100%', padding:'13px 16px', fontSize:15, borderRadius:10,
                  border:'1.5px solid var(--cf-border)', background:'var(--cf-bg)',
                  color:'var(--cf-text-primary)', outline:'none', fontFamily:'var(--font-sans)',
                  boxSizing:'border-box', transition:'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor='var(--cf-green)'}
                onBlur={e => e.target.style.borderColor='var(--cf-border)'}
              />
              {data.name.length > 0 && data.name.length < 2 && (
                <p style={{ fontSize:12, color:'var(--cf-red)', marginTop:6 }}>Escribe al menos 2 caracteres</p>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity:0,x:30 }} animate={{ opacity:1,x:0 }}
              exit={{ opacity:0,x:-30 }} transition={{ duration:0.25 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>🪪</div>
              <h2 style={{ fontSize:20, fontWeight:700, color:'var(--cf-navy)', marginBottom:6 }}>¿Cuál es tu RFC?</h2>
              <p style={{ fontSize:14, color:'var(--cf-text-tertiary)', marginBottom:28, lineHeight:1.6 }}>
                Lo consultamos al SAT para autocompletar tus datos fiscales.<br />
                <strong style={{ color:'var(--cf-text-secondary)' }}>Es opcional</strong> — puedes saltarte este paso.
              </p>
              <label style={{ fontSize:13, fontWeight:500, color:'var(--cf-text-secondary)', display:'block', marginBottom:8 }}>RFC</label>
              <div style={{ position:'relative' }}>
                <input type="text" value={rfc} onChange={e => handleRFC(e.target.value)}
                  placeholder="XAXX010101000" maxLength={13}
                  style={{
                    width:'100%', padding:'13px 48px 13px 16px', fontSize:15, borderRadius:10,
                    border:`1.5px solid ${rfcBorderColor()}`, background:'var(--cf-bg)',
                    color:'var(--cf-text-primary)', outline:'none', fontFamily:'var(--font-mono)',
                    boxSizing:'border-box', letterSpacing:'0.08em',
                    textTransform:'uppercase', transition:'border-color 0.3s',
                  }}
                />
                <span style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', fontSize:18 }}>
                  {rfcStatus === 'loading' ? (
                    <span style={{
                      display:'inline-block', width:18, height:18,
                      border:'2px solid var(--cf-border)', borderTopColor:'var(--cf-blue)',
                      borderRadius:'50%', animation:'spin 0.7s linear infinite',
                    }} />
                  ) : rfcStatusIcon()}
                </span>
              </div>

              {rfcStatus === 'loading' && (
                <p style={{ fontSize:12, color:'var(--cf-blue)', marginTop:6 }}>🔍 Consultando el SAT...</p>
              )}

              {rfcStatus === 'found' && rfcData && (
                <motion.div initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }}
                  style={{
                    marginTop:12, padding:'14px 16px',
                    background:'var(--cf-green-light)', border:'1px solid var(--cf-green)', borderRadius:10,
                  }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--cf-green)', marginBottom:8 }}>✅ RFC verificado en el SAT</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {rfcData.razon_social && (
                      <div style={{ fontSize:13, color:'var(--cf-text-primary)' }}>
                        <span style={{ color:'var(--cf-text-tertiary)' }}>Nombre: </span>
                        <strong>{rfcData.razon_social}</strong>
                      </div>
                    )}
                    {rfcData.regimen_fiscal && (
                      <div style={{ fontSize:13, color:'var(--cf-text-primary)' }}>
                        <span style={{ color:'var(--cf-text-tertiary)' }}>Régimen: </span>{rfcData.regimen_fiscal}
                      </div>
                    )}
                    <div style={{ fontSize:13, color:'var(--cf-text-primary)' }}>
                      <span style={{ color:'var(--cf-text-tertiary)' }}>Tipo: </span>
                      {rfcData.tipo_persona === 'fisica' ? 'Persona Física' : 'Persona Moral'}
                    </div>
                    {rfcData.sat_status !== 'desconocido' && (
                      <div style={{ fontSize:13, color:'var(--cf-text-primary)' }}>
                        <span style={{ color:'var(--cf-text-tertiary)' }}>Estatus SAT: </span>
                        <span style={{ color: rfcData.sat_status === 'activo' ? 'var(--cf-green)' : 'var(--cf-red)', fontWeight:600 }}>
                          {rfcData.sat_status.charAt(0).toUpperCase() + rfcData.sat_status.slice(1)}
                        </span>
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize:11, color:'var(--cf-text-tertiary)', marginTop:8 }}>
                    🤖 Datos autocompletados desde el SAT. Puedes modificarlos en el siguiente paso.
                  </p>
                </motion.div>
              )}

              {(rfcStatus === 'not_found' || rfcStatus === 'error') && (
                <p style={{ fontSize:12, marginTop:6, color: rfcStatus === 'error' ? 'var(--cf-text-tertiary)' : 'var(--cf-red)' }}>
                  {rfcError}
                </p>
              )}

              <div style={{ marginTop:16, padding:'12px 16px', background:'var(--cf-blue-light)', borderRadius:10, fontSize:13, color:'var(--cf-blue)' }}>
                💡 Tu RFC lo encuentras en tu constancia de situación fiscal del SAT o en cualquier factura que hayas recibido.
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity:0,x:30 }} animate={{ opacity:1,x:0 }}
              exit={{ opacity:0,x:-30 }} transition={{ duration:0.25 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>🏛️</div>
              <h2 style={{ fontSize:20, fontWeight:700, color:'var(--cf-navy)', marginBottom:6 }}>¿En qué régimen fiscal estás?</h2>
              {data.regimen_code && (
                <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
                  style={{ marginBottom:16, padding:'8px 14px', background:'var(--cf-green-light)', border:'1px solid var(--cf-green)', borderRadius:8, fontSize:12, color:'var(--cf-green)' }}>
                  ✅ Régimen autodetectado desde el SAT — puedes cambiarlo si es diferente
                </motion.div>
              )}
              <p style={{ fontSize:14, color:'var(--cf-text-tertiary)', marginBottom:24, lineHeight:1.6 }}>
                Esto define cómo calculamos tus impuestos.
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {REGIMENES.map(r => (
                  <div key={r.code}
                    onClick={() => setData(d => ({ ...d, regimen_fiscal:r.label, regimen_code:r.code }))}
                    style={{
                      padding:'12px 16px', borderRadius:10, cursor:'pointer',
                      border:`1.5px solid ${data.regimen_code === r.code ? 'var(--cf-green)' : 'var(--cf-border)'}`,
                      background: data.regimen_code === r.code ? 'var(--cf-green-light)' : 'var(--cf-bg)',
                      transition:'all 0.2s', display:'flex', alignItems:'flex-start', gap:12,
                    }}>
                    <span style={{ fontSize:20, flexShrink:0, marginTop:2 }}>{r.icon}</span>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color: data.regimen_code === r.code ? 'var(--cf-green)' : 'var(--cf-text-primary)' }}>
                        {r.label}
                        <span style={{ marginLeft:8, fontSize:11, color:'var(--cf-text-tertiary)', fontWeight:400 }}>Clave {r.code}</span>
                      </div>
                      <div style={{ fontSize:12, color:'var(--cf-text-tertiary)', marginTop:2, lineHeight:1.5 }}>{r.desc}</div>
                    </div>
                    {data.regimen_code === r.code && (
                      <span style={{ marginLeft:'auto', color:'var(--cf-green)', fontSize:16, flexShrink:0 }}>✓</span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" initial={{ opacity:0,x:30 }} animate={{ opacity:1,x:0 }}
              exit={{ opacity:0,x:-30 }} transition={{ duration:0.25 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>🎯</div>
              <h2 style={{ fontSize:20, fontWeight:700, color:'var(--cf-navy)', marginBottom:6 }}>¿A qué se dedica tu negocio?</h2>
              <p style={{ fontSize:14, color:'var(--cf-text-tertiary)', marginBottom:24, lineHeight:1.6 }}>
                Usaremos esto para sugerirte las categorías correctas para tus ingresos y gastos.
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {CATEGORIAS_EJEMPLO.map(c => (
                  <div key={c.value} onClick={() => setData(d => ({ ...d, categoria_ejemplo:c.value }))}
                    style={{
                      padding:'14px 16px', borderRadius:10, cursor:'pointer', textAlign:'center',
                      border:`1.5px solid ${data.categoria_ejemplo === c.value ? 'var(--cf-navy)' : 'var(--cf-border)'}`,
                      background: data.categoria_ejemplo === c.value ? '#E6F1FB' : 'var(--cf-bg)',
                      transition:'all 0.2s',
                    }}>
                    <div style={{ fontSize:24, marginBottom:6 }}>{c.icon}</div>
                    <div style={{ fontSize:12, fontWeight:500, lineHeight:1.4,
                      color: data.categoria_ejemplo === c.value ? 'var(--cf-navy)' : 'var(--cf-text-secondary)' }}>
                      {c.label}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div key="step5" initial={{ opacity:0,scale:0.95 }} animate={{ opacity:1,scale:1 }}
              exit={{ opacity:0 }} transition={{ duration:0.3 }} style={{ textAlign:'center' }}>
              <motion.div initial={{ scale:0 }} animate={{ scale:1 }}
                transition={{ delay:0.2, type:'spring', stiffness:200 }}
                style={{ fontSize:56, marginBottom:16 }}>🎉</motion.div>
              <h2 style={{ fontSize:22, fontWeight:700, color:'var(--cf-navy)', marginBottom:10 }}>
                ¡Todo listo, {data.name}!
              </h2>
              <p style={{ fontSize:14, color:'var(--cf-text-secondary)', lineHeight:1.7, marginBottom:28 }}>
                Tu cuenta está configurada y lista para usar.<br />
                ContaFácil ya sabe cómo calcular tus impuestos y llevar tus cuentas.
              </p>
              <div style={{ background:'var(--cf-bg-subtle)', borderRadius:12, padding:'16px 20px', marginBottom:28, textAlign:'left' }}>
                {[
                  { label:'Negocio',        value: data.name },
                  { label:'RFC',            value: rfc || 'Por agregar' },
                  { label:'Verificado SAT', value: rfcData?.sat_status === 'activo' ? '✅ Activo' : rfc ? '⚠️ Sin verificar' : '—' },
                  { label:'Régimen',        value: data.regimen_fiscal || 'Por definir' },
                  { label:'Giro',           value: CATEGORIAS_EJEMPLO.find(c => c.value === data.categoria_ejemplo)?.label || '—' },
                ].map(item => (
                  <div key={item.label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--cf-border)', fontSize:13 }}>
                    <span style={{ color:'var(--cf-text-tertiary)' }}>{item.label}</span>
                    <span style={{ color:'var(--cf-text-primary)', fontWeight:500 }}>{item.value}</span>
                  </div>
                ))}
              </div>
              <button onClick={handleFinish} disabled={isLoading}
                style={{
                  width:'100%', padding:'14px 24px', fontSize:16, fontWeight:700,
                  borderRadius:12, border:'none',
                  background: isLoading ? 'var(--cf-bg-subtle)' : 'var(--cf-green)',
                  color: isLoading ? 'var(--cf-text-tertiary)' : '#fff',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontFamily:'var(--font-sans)', display:'flex',
                  alignItems:'center', justifyContent:'center', gap:10, transition:'all 0.2s',
                }}>
                {isLoading ? (
                  <>
                    <span style={{
                      width:18, height:18, borderRadius:'50%',
                      border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff',
                      animation:'spin 0.7s linear infinite', display:'inline-block',
                    }} />
                    Configurando tu cuenta...
                  </>
                ) : '🚀 Entrar a mi dashboard'}
              </button>
            </motion.div>
          )}

        </AnimatePresence>

        {step < 5 && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:32 }}>
            <button onClick={() => step > 1 && setStep(s => s-1)}
              style={{
                background:'none', border:'none',
                color: step === 1 ? 'transparent' : 'var(--cf-text-tertiary)',
                cursor: step === 1 ? 'default' : 'pointer',
                fontSize:14, fontFamily:'var(--font-sans)', padding:'8px 0',
              }}>← Atrás</button>
            <span style={{ fontSize:12, color:'var(--cf-text-tertiary)' }}>Paso {step} de {totalSteps}</span>
            <button onClick={() => canNext() && setStep(s => s+1)} disabled={!canNext()}
              style={{
                padding:'10px 24px', borderRadius:10, border:'none',
                background: canNext() ? 'var(--cf-navy)' : 'var(--cf-bg-subtle)',
                color: canNext() ? '#fff' : 'var(--cf-text-tertiary)',
                cursor: canNext() ? 'pointer' : 'not-allowed',
                fontSize:14, fontWeight:600, fontFamily:'var(--font-sans)', transition:'all 0.2s',
              }}>
              {step === 2 ? (rfc ? 'Siguiente →' : 'Saltar →') : 'Siguiente →'}
            </button>
          </div>
        )}
      </div>

      <p style={{ marginTop:24, fontSize:11, color:'var(--cf-text-tertiary)', textAlign:'center' }}>
        ContaFácil © 2026 — MMV Digital · Todos los derechos reservados
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } input::placeholder { color: var(--cf-text-tertiary); }`}</style>
    </div>
  )
}
