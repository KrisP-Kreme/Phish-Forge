'use client'

import { useEffect, useRef, useState, ReactNode } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import DomainForm from './DomainForm'

type LaptopState = 'idle' | 'lhs' | 'rhs' | 'thinking'

interface LaptopMockupProps {
  children: ReactNode
  onTyping?: (isTyping: boolean) => void
  onError?: (error: string) => void
}

export default function LaptopMockup({ children, onTyping, onError }: LaptopMockupProps) {
  const [, forceUpdate] = useState({})
  const [isFormSuccess, setIsFormSuccess] = useState(false)
  const [showRodingAnimation, setShowRodingAnimation] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const rodingRef = useRef<HTMLDivElement>(null)
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const thinkingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const thinkingShownRef = useRef(false)
  
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

    // If currently in thinking state, transition to typing state
    if (laptopStateRef.current === 'thinking') {
      const nextState = lastStateRef.current === 'lhs' ? 'rhs' : 'lhs'
      lastStateRef.current = nextState
      laptopStateRef.current = nextState
      isTypingRef.current = true
      updateImage()
      onTyping?.(true)
      // Return to idle after 500ms of no typing
      idleTimeoutRef.current = setTimeout(() => {
        returnToIdle()
      }, 500)
      return
    }

    isTypingRef.current = true
    const nextState = lastStateRef.current === 'lhs' ? 'rhs' : 'lhs'
    lastStateRef.current = nextState
    laptopStateRef.current = nextState

    // Update immediately - images are preloaded
    updateImage()

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
      return new Promise<void>((resolve) => {
        const img = new window.Image()
        img.onload = () => resolve()
        img.onerror = () => resolve() // Resolve even on error to not block
        img.src = src
      })
    }
    
    // Start preloading immediately for all states
    const imagePromises = [
      preloadImage('/idle.png'),
      preloadImage('/lhs.png'),
      preloadImage('/rhs.png'),
      preloadImage('/think.png')
    ]
    
    // Wait for all images to load before marking as ready
    Promise.all(imagePromises).then(() => {
      // Mark images as loaded so first keypress can change images smoothly
      thinkingShownRef.current = true
    }).catch(() => {
      // Even if loading fails, mark as ready to prevent infinite waiting
      thinkingShownRef.current = true
    })
  }, [])

  useEffect(() => {
    // Show thinking state on initial mount for 1 second
    laptopStateRef.current = 'thinking'
    updateImage()
    
    // Transition to idle after 1 second
    thinkingTimeoutRef.current = setTimeout(() => {
      laptopStateRef.current = 'idle'
      thinkingShownRef.current = true
      updateImage()
    }, 1000)
    
    return () => {
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // If success animation completes, trigger roding image after a brief delay
    if (isFormSuccess) {
      const timer = setTimeout(() => {
        setShowRodingAnimation(true)
      }, 850) // After the slide-off animation completes
      return () => clearTimeout(timer)
    }
  }, [isFormSuccess])

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
      case 'thinking':
        return '/think.png'
      case 'idle':
      default:
        return '/idle.png'
    }
  })()

  return (
    <>
      <style>{`
        @keyframes slideUpIn {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes slideUpFromBottom {
          from {
            transform: translateY(200px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes dot1 {
          0%, 20% { opacity: 0; }
          40%, 80% { opacity: 1; }
          100% { opacity: 0; }
        }

        @keyframes dot2 {
          0%, 40% { opacity: 0; }
          60%, 80% { opacity: 1; }
          100% { opacity: 0; }
        }

        @keyframes dot3 {
          0%, 60% { opacity: 0; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }

        .dot {
          display: inline-block;
          animation-duration: 1.5s;
          animation-iteration-count: infinite;
        }

        .dot:nth-child(1) {
          animation-name: dot1;
        }

        .dot:nth-child(2) {
          animation-name: dot2;
        }

        .dot:nth-child(3) {
          animation-name: dot3;
        }
        
        .dirty-bezel::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: 
            radial-gradient(ellipse 80px 40px at 10% 15%, rgba(0, 0, 0, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse 60px 30px at 90% 25%, rgba(0, 0, 0, 0.06) 0%, transparent 50%),
            radial-gradient(ellipse 50px 35px at 20% 80%, rgba(0, 0, 0, 0.07) 0%, transparent 50%),
            radial-gradient(ellipse 70px 45px at 85% 70%, rgba(0, 0, 0, 0.05) 0%, transparent 50%),
            radial-gradient(circle 3px at 15% 20%, rgba(0, 0, 0, 0.3), transparent 100%),
            radial-gradient(circle 2px at 75% 35%, rgba(0, 0, 0, 0.25), transparent 100%),
            radial-gradient(circle 2.5px at 25% 75%, rgba(0, 0, 0, 0.28), transparent 100%),
            radial-gradient(circle 2px at 70% 60%, rgba(0, 0, 0, 0.2), transparent 100%);
          border-radius: 12px;
          border: 32px solid transparent;
          box-shadow: inset 0 0 0 32px;
        }
      `}</style>
      <div className="w-full flex flex-col items-center justify-center px-4 sm:px-6 md:px-8" ref={containerRef}>
        {/* Laptop mockup container - responsive sizing */}
        <div className="relative w-full max-w-4xl">
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={isFormSuccess ? { opacity: 0, y: 1000 } : { opacity: 1, y: 0 }}
          transition={isFormSuccess ? { duration: 0.8, ease: 'easeIn' } : { duration: 0 }}
          style={{ width: '100%', display: 'block' }}
        >
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

        {/* Virtual screen overlay - fixed 1920x1080, scales via transform */}
        <div
          ref={screenRef}
          className="absolute inset-0"
          style={{
            width: '1920px',
            height: '1080px',
            transformOrigin: 'top left',
            pointerEvents: 'none', // Allow pointer events through to content
            animation: 'slideUpIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          }}
        >
          {/* Screen content area - positioned within virtual screen bounds */}
          <div
            className="absolute flex items-center justify-center"
            style={{
              // Positioned inside the laptop screen area with proportional insets
              top: '15%',
              left: '6%',
              right: '59%',
              bottom: '60%',
              pointerEvents: 'auto', // Re-enable pointer events for content
            }}
          >
            {children || <DomainForm onTyping={onTyping} isThinking={laptopStateRef.current === 'thinking'} onError={onError} onSuccess={() => setIsFormSuccess(true)} />}
          </div>
        </div>
        </motion.div>

        {/* Roding image animation - appears after form success */}
        {showRodingAnimation && (
          <motion.div
            ref={rodingRef}
            initial={{ opacity: 0, y: 200 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="absolute inset-0"
            style={{
              width: '1920px',
              height: '1080px',
              transformOrigin: 'top left',
              pointerEvents: 'auto',
            }}
          >
            <div
              className="absolute flex items-center justify-center"
              style={{
                top: 'auto',
                left: '1%',
                right: '53%',
                bottom: '11.5%',
                pointerEvents: 'auto',
              }}
            >
              <Image
                src="/roding.png"
                alt="Roding animation"
                width={1200}
                height={800}
                unoptimized
                className="w-full h-auto block"
              />
            </div>

            {/* Text overlay - appears with the fishing animation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="absolute"
              style={{
                top: '15%',
                left: '3%',
                pointerEvents: 'none',
                maxWidth: '400px',
              }}
            >
              <p
                className="text-2xl md:text-3xl font-bold tracking-tight"
                style={{
                  fontFamily: 'inherit',
                  color: 'currentColor',
                  whiteSpace: 'nowrap',
                }}
              >
                waiting for a nibble<span className="dot">.</span><span className="dot">.</span><span className="dot">.</span>
              </p>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
    </>
  )
}