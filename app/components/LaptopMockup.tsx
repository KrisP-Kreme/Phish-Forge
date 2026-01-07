'use client'

import { useEffect, useRef, useState, ReactNode } from 'react'
import Image from 'next/image'

type LaptopState = 'idle' | 'lhs' | 'rhs'

interface LaptopMockupProps {
  children: ReactNode
  onTyping?: (isTyping: boolean) => void
}

export default function LaptopMockup({ children, onTyping }: LaptopMockupProps) {
  const [, forceUpdate] = useState({})
  const containerRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Track state in refs only - no React state batching interference
  const laptopStateRef = useRef<LaptopState>('idle')
  const lastStateRef = useRef<'lhs' | 'rhs'>('rhs')
  const isTypingRef = useRef(false)
  const scaleRef = useRef(1)

  const updateImage = () => {
    forceUpdate({})
  }

  const returnToIdle = () => {
    lastStateRef.current = 'rhs'
    isTypingRef.current = false
    laptopStateRef.current = 'idle'
    updateImage()
    onTyping?.(false)
  }

  const handleTypingStart = () => {
    // Clear any pending idle timeout
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
    }

    const comingFromIdle = !isTypingRef.current

    // Mark that we're typing
    if (!isTypingRef.current) {
      isTypingRef.current = true
    }

    // Toggle between lhs and rhs
    const nextState = lastStateRef.current === 'lhs' ? 'rhs' : 'lhs'
    lastStateRef.current = nextState
    laptopStateRef.current = nextState

    // If coming from idle, use requestAnimationFrame for gentler transition
    if (comingFromIdle) {
      requestAnimationFrame(() => {
        updateImage()
      })
    } else {
      // For subsequent keystrokes, update immediately
      updateImage()
    }

    onTyping?.(true)

    // Return to idle after 500ms of no typing
    idleTimeoutRef.current = setTimeout(() => {
      returnToIdle()
    }, 500)
  }

  // Calculate and apply scale on mount and resize
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current || !screenRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const parentWidth = containerRef.current.offsetWidth
      const parentHeight = containerRef.current.offsetHeight

      // Virtual screen dimensions
      const virtualWidth = 1920
      const virtualHeight = 1080

      // Calculate scale to fit virtual screen within available space
      const scaleX = parentWidth / virtualWidth
      const scaleY = parentHeight / virtualHeight
      const scale = Math.min(scaleX, scaleY)

      scaleRef.current = scale
      
      // Apply transform
      screenRef.current.style.transform = `scale(${scale})`
      screenRef.current.style.transformOrigin = 'top left'
    }

    // Initial calculation
    updateScale()

    // Recalculate on window resize
    const resizeObserver = new ResizeObserver(updateScale)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    window.addEventListener('resize', updateScale)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateScale)
    }
  }, [])

  useEffect(() => {
    // Preload all images at mount to prevent flashing
    const preloadImage = (src: string) => {
      const img = new window.Image()
      img.src = src
    }
    
    preloadImage('/idle.png')
    preloadImage('/lhs.png')
    preloadImage('/rhs.png')
  }, [])

  useEffect(() => {
    return () => {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current)
      }
    }
  }, [])

  // Use keydown event - fires BEFORE character is added to input
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleKeyDown = (e: Event) => {
      const target = e.target as HTMLElement
      // Check if the event came from an input or textarea
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        const keyEvent = e as KeyboardEvent
        // Respond to printable characters and backspace/delete
        if (keyEvent.key.length === 1 || keyEvent.key === 'Backspace' || keyEvent.key === 'Delete') {
          handleTypingStart()
        }
      }
    }

    // Use keydown - fires immediately before character is added
    container.addEventListener('keydown', handleKeyDown, true)

    return () => {
      container.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [])

  const imageSrc = (() => {
    switch (laptopStateRef.current) {
      case 'lhs':
        return '/lhs.png'
      case 'rhs':
        return '/rhs.png'
      case 'idle':
      default:
        return '/idle.png'
    }
  })()

  return (
    <div className="w-full flex flex-col items-center justify-center px-4 sm:px-6 md:px-8" ref={containerRef}>
      {/* Laptop mockup container - responsive sizing */}
      <div className="relative w-full max-w-4xl">
        <Image
          src={imageSrc}
          alt="Laptop mockup"
          width={1200}
          height={800}
          priority
          unoptimized
          className="w-full h-auto block"
          style={{ transition: 'opacity 100ms ease-out' }}
        />

        {/* Virtual screen overlay - scales to fit laptop screen at any resolution */}
        <div
          ref={screenRef}
          className="absolute inset-0"
          style={{
            width: '1920px',
            height: '1080px',
            transformOrigin: 'top left',
            pointerEvents: 'none',
          }}
        >
          {/* Screen content area - positioned within virtual screen */}
          <div
            className="absolute flex items-center justify-center"
            style={{
              // Positioned inside the laptop screen area (proportional to 1920x1080)
              // Adjusted to match actual screen position in the mockup
              top: '180px',      // ~9.4% - screen starts higher
              left: '100px',     // ~5.2% of 1920
              right: '100px',    // ~5.2% of 1920
              bottom: '400px',   // ~37% - more space for keyboard
              pointerEvents: 'auto',
              overflow: 'hidden',
            }}
          >
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                overflow: 'auto',
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}