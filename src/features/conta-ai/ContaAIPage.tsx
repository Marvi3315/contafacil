import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { toast } from 'sonner'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ContextoFinanciero {
  organizacion: string
  rfc: string
  regimen: string
  periodo: string
  totalIngresos: number
  totalEgresos: number
  totalIVA: number
  totalISR: number
  totalLibre: number
  margen: number
  numTransacciones: number
}

const SUGERENCIAS = [
  '¿Cuánto le debo al SAT este mes?',
  '¿Cómo va mi negocio comparado con el mes pasado?',
  '¿Qué gastos puedo deducir?',
  '¿Cuándo vence mi declaración de IVA?',
  '¿Qué es el RESICO y me conviene?',
  '¿Cómo registro una factura recibida?',
  '¿Qué pasa si no declaro a tiempo?',
  'Explícame el IVA como si tuviera 10 años',
]

export default function ContaAIPage() {
  const { activeOrg } = useAuthStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [contexto, setContexto] = useState<ContextoFinanciero | null>(null)
  const [modoContador, setModoContador] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (activeOrg) {
      cargarContexto()
      setMessages([{
        id: '1',
        role: 'assistant',
        content: `¡Hola! Soy **Conta**, tu asistente contable personal 👋\n\nEstoy conectado a los datos reales de **${activeOrg.name}** y puedo ayudarte a entender tus finanzas, calcular impuestos, y explicarte cualquier tema fiscal en lenguaje simple.\n\n¿En qué te puedo ayudar hoy?`,
        timestamp: new Date(),
      }])
    }
  }, [activeOrg])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const cargarContexto = async () => {
    if (!activeOrg) return
    try {
      const periodo = format(new Date(), 'yyyy-MM')
      const desde = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const hasta = format(endOfMonth(new Date()), 'yyyy-MM-dd')

      const { data: txs } = await supabase
        .from('transactions')
        .select('type, amount, iva')
        .eq('org_id', activeOrg.id)
        .eq('status', 'confirmado')
        .gte('date', desde)
        .lte('date', hasta)

      const totalIngresos = (txs ?? []).filter(t => t.type === 'ingreso').reduce((s, t) => s + Number(t.amount), 0)
      const totalEgresos = (txs ?? []).filter(t => t.type === 'egreso').reduce((s, t) => s + Number(t.amount), 0)
      const totalIVA = (txs ?? []).reduce((s, t) => s + Number(t.iva ?? 0), 0)
      const totalISR = totalIngresos * 0.1
      const totalLibre = totalIngresos - totalEgresos - totalIVA - totalISR
      const margen = totalIngresos > 0 ? (totalLibre / totalIngresos) * 100 : 0

      setContexto({
        organizacion: activeOrg.name,
        rfc: activeOrg.rfc ?? 'No registrado',
        regimen: activeOrg.regimen_fiscal ?? 'No configurado',
        periodo,
        totalIngresos,
        totalEgresos,
        totalIVA,
        totalISR,
        totalLibre,
        margen,
        numTransacciones: (txs ?? []).length,
      })
    } catch (err) {
      console.error('Error cargando contexto:', err)
    }
  }

  const enviarMensaje = async (texto?: string) => {
    const mensajeTexto = texto ?? input.trim()
    if (!mensajeTexto || isLoading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: mensajeTexto,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const systemPrompt = `Eres Conta, un asistente contable amigable y experto en el sistema fiscal mexicano (SAT, ISR, IVA, CFDI, RESICO, etc.) integrado en ContaFácil, una aplicación de contabilidad para pequeñas empresas mexicanas desarrollada por MMV Digital.

CONTEXTO FINANCIERO REAL DEL USUARIO (datos del mes actual):
- Organización: ${contexto?.organizacion ?? 'No disponible'}
- RFC: ${contexto?.rfc ?? 'No registrado'}
- Régimen fiscal: ${contexto?.regimen ?? 'No configurado'}
- Período: ${contexto?.periodo ?? format(new Date(), 'yyyy-MM')}
- Total ingresos del mes: ${formatCurrency(contexto?.totalIngresos ?? 0)}
- Total egresos del mes: ${formatCurrency(contexto?.totalEgresos ?? 0)}
- IVA estimado: ${formatCurrency(contexto?.totalIVA ?? 0)}
- ISR estimado: ${formatCurrency(contexto?.totalISR ?? 0)}
- Lo que queda libre: ${formatCurrency(contexto?.totalLibre ?? 0)}
- Margen neto: ${Math.round(contexto?.margen ?? 0)}%
- Número de transacciones: ${contexto?.numTransacciones ?? 0}

MODO: ${modoContador ? 'CONTADOR PROFESIONAL — usa terminología técnica, referencias a artículos del CFF, datos precisos' : 'USUARIO NORMAL — usa lenguaje simple, sin tecnicismos, explica todo como si fuera la primera vez que escuchan sobre contabilidad'}

INSTRUCCIONES:
- Responde SIEMPRE en español
- Usa los datos reales del usuario cuando sean relevantes
- Sé conciso pero completo
- Si es modo normal: usa emojis ocasionalmente, analogías simples, evita términos técnicos
- Si es modo contador: usa terminología fiscal precisa, menciona artículos de ley cuando aplique
- Nunca inventes datos fiscales — si no sabes algo, dilo claramente
- Recuerda que el vencimiento de declaraciones mensuales es el día 17 del mes siguiente
- Si el usuario pregunta algo que requiere atención urgente del SAT, indícalo claramente
- Formato: usa **negritas** para conceptos importantes y saltos de línea para mejor lectura`

      const historial = messages.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            ...historial,
            { role: 'user', content: mensajeTexto },
          ],
        }),
      })

      if (!response.ok) throw new Error('Error al conectar con Conta IA')

      const data = await response.json()
      const respuesta = data.content?.[0]?.text ?? 'Lo siento, no pude procesar tu pregunta. Intenta de nuevo.'

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: respuesta,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      console.error('Error Conta IA:', err)
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '⚠️ Hubo un error al conectar con Conta IA. Verifica que la API key de Anthropic esté configurada en las variables de entorno.\n\nMientras tanto, puedes revisar el módulo del SAT para ver tus impuestos calculados.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviarMensaje()
    }
  }

  const limpiarChat = () => {
    if (!activeOrg) return
    setMessages([{
      id: Date.now().toString(),
      role: 'assistant',
      content: `Chat reiniciado. ¡Hola de nuevo! Soy **Conta**, tu asistente contable de **${activeOrg.name}**. ¿En qué te puedo ayudar? 😊`,
      timestamp: new Date(),
    }])
  }

  // Renderizar markdown básico
  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', gap: 0 }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 0 16px', flexWrap: 'wrap', gap: 12, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #185FA5, #1D9E75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
          }}>
            🤖
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--cf-navy)', margin: 0 }}>
              Conta IA
            </h1>
            <p style={{ fontSize: 12, color: 'var(--cf-text-tertiary)', margin: 0 }}>
              Tu contador personal con inteligencia artificial
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Toggle modo */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px', borderRadius: 20,
            background: 'var(--cf-bg-subtle)',
            border: '1px solid var(--cf-border)',
            fontSize: 12,
          }}>
            <span style={{ color: !modoContador ? 'var(--cf-navy)' : 'var(--cf-text-tertiary)', fontWeight: !modoContador ? 600 : 400 }}>
              👤 Simple
            </span>
            <div
              onClick={() => setModoContador(v => !v)}
              style={{
                width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                background: modoContador ? 'var(--cf-navy)' : 'var(--cf-border-md)',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2,
                left: modoContador ? 18 : 2,
                transition: 'left 0.2s',
              }} />
            </div>
            <span style={{ color: modoContador ? 'var(--cf-navy)' : 'var(--cf-text-tertiary)', fontWeight: modoContador ? 600 : 400 }}>
              🧮 Contador
            </span>
          </div>

          <button
            onClick={limpiarChat}
            style={{
              padding: '7px 14px', borderRadius: 8,
              border: '1px solid var(--cf-border)',
              background: 'none', color: 'var(--cf-text-secondary)',
              fontSize: 12, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            🗑️ Limpiar
          </button>
        </div>
      </div>

      {/* ── Contexto financiero ── */}
      {contexto && (
        <div style={{
          display: 'flex', gap: 10, flexWrap: 'wrap',
          padding: '10px 14px', borderRadius: 10,
          background: 'var(--cf-bg-subtle)',
          border: '1px solid var(--cf-border)',
          marginBottom: 12, flexShrink: 0,
          fontSize: 12,
        }}>
          <span style={{ color: 'var(--cf-text-tertiary)' }}>
            📊 Conectado a <strong style={{ color: 'var(--cf-navy)' }}>{contexto.organizacion}</strong>
          </span>
          <span style={{ color: 'var(--cf-text-tertiary)' }}>·</span>
          <span style={{ color: 'var(--cf-green)', fontWeight: 600 }}>
            Ingresos: {formatCurrency(contexto.totalIngresos)}
          </span>
          <span style={{ color: 'var(--cf-text-tertiary)' }}>·</span>
          <span style={{ color: 'var(--cf-amber)', fontWeight: 600 }}>
            SAT: {formatCurrency(contexto.totalIVA + contexto.totalISR)}
          </span>
          <span style={{ color: 'var(--cf-text-tertiary)' }}>·</span>
          <span style={{ color: 'var(--cf-navy)', fontWeight: 600 }}>
            Libre: {formatCurrency(contexto.totalLibre)}
          </span>
        </div>
      )}

      {/* ── Área de mensajes ── */}
      <div style={{
        flex: 1, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 12,
        paddingRight: 4, marginBottom: 12,
      }}>
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                gap: 10,
              }}
            >
              {/* Avatar Conta */}
              {msg.role === 'assistant' && (
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, #185FA5, #1D9E75)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, alignSelf: 'flex-end',
                }}>
                  🤖
                </div>
              )}

              {/* Burbuja */}
              <div style={{
                maxWidth: '75%',
                padding: '12px 16px',
                borderRadius: msg.role === 'user'
                  ? '16px 16px 4px 16px'
                  : '16px 16px 16px 4px',
                background: msg.role === 'user'
                  ? 'var(--cf-navy)'
                  : 'var(--cf-bg-card)',
                border: msg.role === 'user'
                  ? 'none'
                  : '1px solid var(--cf-border)',
                color: msg.role === 'user' ? '#fff' : 'var(--cf-text-primary)',
                fontSize: 14,
                lineHeight: 1.7,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}>
                <div
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                />
                <div style={{
                  fontSize: 10,
                  color: msg.role === 'user' ? 'rgba(255,255,255,0.5)' : 'var(--cf-text-tertiary)',
                  marginTop: 6, textAlign: 'right',
                }}>
                  {format(msg.timestamp, 'HH:mm')}
                </div>
              </div>

              {/* Avatar usuario */}
              {msg.role === 'user' && (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--cf-navy)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#fff',
                  alignSelf: 'flex-end',
                }}>
                  {activeOrg?.name?.[0]?.toUpperCase() ?? 'U'}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #185FA5, #1D9E75)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            }}>
              🤖
            </div>
            <div style={{
              padding: '14px 18px', borderRadius: '16px 16px 16px 4px',
              background: 'var(--cf-bg-card)', border: '1px solid var(--cf-border)',
              display: 'flex', gap: 5, alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--cf-text-tertiary)',
                  animation: 'bounce 1.2s infinite',
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Sugerencias ── */}
      {messages.length <= 1 && !isLoading && (
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap',
          marginBottom: 12, flexShrink: 0,
        }}>
          {SUGERENCIAS.slice(0, 4).map(s => (
            <button
              key={s}
              onClick={() => enviarMensaje(s)}
              style={{
                padding: '7px 14px', borderRadius: 20,
                border: '1px solid var(--cf-border)',
                background: 'var(--cf-bg-card)',
                color: 'var(--cf-text-secondary)',
                fontSize: 12, cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--cf-navy)'
                e.currentTarget.style.color = 'var(--cf-navy)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--cf-border)'
                e.currentTarget.style.color = 'var(--cf-text-secondary)'
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ── */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-end',
        flexShrink: 0,
        padding: '12px 0 0',
        borderTop: '1px solid var(--cf-border)',
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pregúntale a Conta sobre tus finanzas... (Enter para enviar)"
          rows={1}
          style={{
            flex: 1, padding: '12px 16px', fontSize: 14,
            borderRadius: 12, border: '1.5px solid var(--cf-border)',
            background: 'var(--cf-bg-card)', color: 'var(--cf-text-primary)',
            outline: 'none', fontFamily: 'var(--font-sans)',
            resize: 'none', lineHeight: 1.6, maxHeight: 120,
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--cf-navy)'}
          onBlur={e => e.target.style.borderColor = 'var(--cf-border)'}
          onInput={e => {
            const t = e.target as HTMLTextAreaElement
            t.style.height = 'auto'
            t.style.height = Math.min(t.scrollHeight, 120) + 'px'
          }}
          disabled={isLoading}
        />
        <button
          onClick={() => enviarMensaje()}
          disabled={isLoading || !input.trim()}
          style={{
            width: 44, height: 44, borderRadius: 12, border: 'none',
            background: isLoading || !input.trim() ? 'var(--cf-bg-subtle)' : 'var(--cf-navy)',
            color: isLoading || !input.trim() ? 'var(--cf-text-tertiary)' : '#fff',
            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
            fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s', flexShrink: 0,
          }}
        >
          {isLoading ? '⏳' : '↑'}
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}
