'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'

const TYPEWRITER_SPEED = 50 // ms per character
const DELETE_SPEED = 30 // ms per character
const PAUSE_TIME = 1500 // ms to pause after typing

const EXAMPLE_DOMAINS = [
  'www.jamieoliver.com',
  'www.fishing-victoria.com',
  'www.clamms.com.au',
  'www.livefish.com.au',
]

interface DomainFormProps {
  onTyping?: (isTyping: boolean) => void
}

export default function DomainForm({ onTyping }: DomainFormProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hasUserTypedRef = useRef(false)
  
  const [value, setValue] = useState('')
  const [displayValue, setDisplayValue] = useState('www.fakedomain.com.au')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [cursorVisible, setCursorVisible] = useState(true)
  const [currentDomainIndex, setCurrentDomainIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const typewriterTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Animated cursor effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Placeholder typewriter animation that cycles through example domains
  useEffect(() => {
    // Stop animation permanently once user has typed at least once
    if (hasUserTypedRef.current) return
    
    // Only animate when user hasn't typed anything
    if (value.length > 0) {
      hasUserTypedRef.current = true
      return
    }

    if (typewriterTimeoutRef.current) {
      clearTimeout(typewriterTimeoutRef.current)
    }

    const currentDomain = EXAMPLE_DOMAINS[currentDomainIndex]

    if (!isDeleting) {
      // Typing phase
      if (displayValue.length < currentDomain.length) {
        typewriterTimeoutRef.current = setTimeout(() => {
          setDisplayValue(currentDomain.slice(0, displayValue.length + 1))
        }, TYPEWRITER_SPEED)
      } else {
        // Finished typing, pause then start deleting
        typewriterTimeoutRef.current = setTimeout(() => {
          setIsDeleting(true)
        }, PAUSE_TIME)
      }
    } else {
      // Deleting phase
      if (displayValue.length > 0) {
        typewriterTimeoutRef.current = setTimeout(() => {
          setDisplayValue(displayValue.slice(0, -1))
        }, DELETE_SPEED)
      } else {
        // Finished deleting, move to next domain
        setIsDeleting(false)
        setCurrentDomainIndex((prev) => (prev + 1) % EXAMPLE_DOMAINS.length)
      }
    }

    return () => {
      if (typewriterTimeoutRef.current) {
        clearTimeout(typewriterTimeoutRef.current)
      }
    }
  }, [displayValue, isDeleting, currentDomainIndex, value])

  const handleScrape = async () => {
    if (!value.trim()) {
      setError('Please enter a domain')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // TODO: Add API call to process domain
      console.log('Processing domain:', value)
      // Simulated delay
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process domain')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading && value.trim()) {
      handleScrape()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    onTyping?.(e.target.value.length > 0)
  }

  return (
    <div
      className="p-6 rounded-lg border-2 flex flex-col"
      style={{
        backgroundColor: '#f1e6c7',
        borderColor: 'var(--border)',
        width: '1400px',  // Fixed width in virtual screen pixels (leaves ~260px margin)
        height: '300px',  // Fixed height in virtual screen pixels
      }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex-shrink-0">
          <motion.h1
            className="text-3xl font-bold mb-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            Domain
          </motion.h1>
          <motion.p
            className="text-sm text-[var(--muted-foreground)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            Enter a target domain
          </motion.p>
        </div>

        <motion.div
          className="flex items-center gap-2 flex-shrink-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="flex-1 relative min-w-0">
            <input
              ref={inputRef}
              value={value}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder=""
              className="w-full font-mono px-3 py-2 rounded-lg border bg-transparent relative text-sm outline-none transition-all"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
              disabled={isLoading}
              autoFocus
            />

            {!value && !hasUserTypedRef.current && (
              <span
                aria-hidden
                className="pointer-events-none select-none absolute top-1/2 transform -translate-y-1/2 font-mono text-[var(--muted-foreground)]"
                style={{
                  left: '12px',
                  whiteSpace: 'pre',
                  fontSize: 'inherit',
                }}
              >
                {displayValue}
                <span
                  style={{
                    color: 'var(--primary)',
                    opacity: cursorVisible ? 1 : 0,
                    transition: 'opacity 300ms ease',
                  }}
                >
                  |
                </span>
              </span>
            )}
          </div>

          <motion.button
            onClick={handleScrape}
            disabled={isLoading || !value.trim()}
            className="text-[var(--primary-foreground)] font-semibold px-4 py-2 rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed border-2 text-sm whitespace-nowrap flex-shrink-0"
            style={{ backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isLoading ? '...' : 'Go'}
          </motion.button>
        </motion.div>

        {error && (
          <motion.div
            className="mt-2 p-3 rounded flex-shrink-0"
            style={{
              backgroundColor: 'var(--destructive)',
              color: 'var(--destructive-foreground)',
            }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-sm font-semibold">Error: {error}</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}