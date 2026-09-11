import React, { useEffect, useState, useRef } from 'react'

export interface CircuitTrackImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  className?: string
  /**
   * Limiar de luminância média (0 a 1). Abaixo disso o traço é considerado escuro.
   * Padrão: 0.4 (40%)
   */
  darkThreshold?: number
}

/**
 * Componente para exibição inteligente de traçados de circuitos.
 *
 * Detecta via canvas offscreen a luminância média dos pixels opacos (traçado).
 * Se o traço for escuro (ex: SVG ou PNG preto sobre fundo transparente),
 * aplica `invert(1)` para que fique nítido e visível em fundos escuros do jogo.
 * Se o traço já for claro, não aplica filtro.
 * Se houver erro de CORS ou quebra na leitura do canvas, aplica `invert(1)` como fallback seguro.
 * Enquanto a detecção não terminar, renderiza SEM filtro.
 * Recalcula se a `src` mudar.
 */
export const CircuitTrackImage: React.FC<CircuitTrackImageProps> = ({
  src,
  alt,
  className = '',
  darkThreshold = 0.4,
  style,
  crossOrigin = 'anonymous',
  onLoad,
  onError,
  ...props
}) => {
  // Estado do filtro: 'none' (claro/neutro), 'invert' (escuro -> invert(1)), ou null (analisando)
  const [filterMode, setFilterMode] = useState<'none' | 'invert' | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const lastAnalyzedSrcRef = useRef<string | null>(null)

  // Analisa a luminância de uma imagem via canvas offscreen
  const analyzeLuminance = (img: HTMLImageElement) => {
    if (!img.naturalWidth || !img.naturalHeight) {
      return
    }

    lastAnalyzedSrcRef.current = src

    try {
      // Amostragem em canvas offscreen reduzido para alta performance
      const maxDim = 128
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
      const width = Math.max(1, Math.round(img.naturalWidth * scale))
      const height = Math.max(1, Math.round(img.naturalHeight * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        // Fallback seguro se não conseguir contexto 2D
        setFilterMode('invert')
        return
      }

      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)

      const imgData = ctx.getImageData(0, 0, width, height)
      const data = imgData.data

      let totalLuminance = 0
      let opaquePixelCount = 0

      // Percorre os pixels buscando pixels com alpha significativo (opacos / traçado)
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3]
        if (a > 30) {
          // alpha > ~12% (ignora ruídos e fundo totalmente transparente)
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]

          // Fórmula ITU-R BT.709 para luminância perceptual: 0.2126 R + 0.7152 G + 0.0722 B
          const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
          totalLuminance += lum
          opaquePixelCount++
        }
      }

      if (opaquePixelCount === 0) {
        // Imagem completamente transparente ou não detectada: fallback seguro
        setFilterMode('invert')
        return
      }

      const avgLuminance = totalLuminance / opaquePixelCount

      // Se a luminância for menor que o limiar (ex: 40%), o traço é escuro -> inverter para branco
      if (avgLuminance < darkThreshold) {
        setFilterMode('invert')
      } else {
        setFilterMode('none')
      }
    } catch {
      // Se estourar erro (ex.: SecurityError por CORS / tainted canvas), usa fallback seguro invert(1)
      setFilterMode('invert')
    }
  }

  // Quando a src mudar, resetamos para estado neutro (sem filtro enquanto detecta)
  // e se a imagem já estiver em cache/complete, roda a análise imediatamente
  useEffect(() => {
    if (src !== lastAnalyzedSrcRef.current) {
      setFilterMode(null)
      if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
        analyzeLuminance(imgRef.current)
      }
    }
  }, [src])

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = event.currentTarget

    if (onLoad) {
      onLoad(event)
    }

    analyzeLuminance(img)
  }

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (onError) {
      onError(event)
    }
    // Em caso de erro na imagem, fallback seguro
    setFilterMode('invert')
  }

  // Enquanto a detecção não terminar, renderiza sem filtro
  const computedFilter = filterMode === 'invert' ? 'invert(1)' : undefined

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      crossOrigin={crossOrigin}
      className={className}
      style={{
        ...style,
        ...(computedFilter ? { filter: computedFilter } : {}),
      }}
      onLoad={handleImageLoad}
      onError={handleImageError}
      {...props}
    />
  )
}

export default CircuitTrackImage
