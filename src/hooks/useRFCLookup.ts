// ═══════════════════════════════════════════════════════════
//  useRFCLookup.ts — Hook para consulta RFC
//  ContaFácil / DeclaraYa — MMV Digital © 2026
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react'
import {
  lookupRFC,
  validarFormatoRFC,
  normalizarRFC,
  type RFCData,
  type RFCLookupStatus,
} from '@/services/rfcService'

interface UseRFCLookupReturn {
  rfc: string
  rfcData: RFCData | null
  status: RFCLookupStatus
  errorMsg: string
  handleRFCChange: (value: string) => void
  clearRFC: () => void
}

export function useRFCLookup(
  onDataFound?: (data: RFCData) => void
): UseRFCLookupReturn {
  const [rfc, setRFC]         = useState('')
  const [rfcData, setRFCData] = useState<RFCData | null>(null)
  const [status, setStatus]   = useState<RFCLookupStatus>('idle')
  const [errorMsg, setError]  = useState('')
  const debounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleRFCChange = useCallback((value: string) => {
    const clean = normalizarRFC(value)
    setRFC(clean)
    setRFCData(null)
    setError('')

    // Limpiar debounce anterior
    if (debounceRef.current) clearTimeout(debounceRef.current)

    // RFC muy corto — nada que validar
    if (clean.length < 12) {
      setStatus('idle')
      return
    }

    // Validar formato primero (local, sin API)
    if (!validarFormatoRFC(clean)) {
      setStatus('not_found')
      setError('Formato de RFC inválido. Verifica que esté bien escrito.')
      return
    }

    // Debounce 800ms para no spamear el API
    setStatus('loading')
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await lookupRFC(clean)

        if (!data) {
          setStatus('not_found')
          setError('RFC no encontrado en el SAT. Verifica que esté correcto.')
          return
        }

        setRFCData(data)
        setStatus('found')
        setError('')
        onDataFound?.(data)

      } catch {
        setStatus('error')
        setError('No se pudo consultar el SAT. Continúa y verifica después.')
      }
    }, 800)
  }, [onDataFound])

  const clearRFC = useCallback(() => {
    setRFC('')
    setRFCData(null)
    setStatus('idle')
    setError('')
  }, [])

  return { rfc, rfcData, status, errorMsg, handleRFCChange, clearRFC }
}
