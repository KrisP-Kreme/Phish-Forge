'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface ErrorNotificationProps {
  message: string | null
  onDismiss?: () => void
}

export default function ErrorNotification({ message, onDismiss }: ErrorNotificationProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (message) {
      setIsVisible(true)
      const timer = setTimeout(() => {
        setIsVisible(false)
        onDismiss?.()
      }, 5000) // Auto-dismiss after 5 seconds

      return () => clearTimeout(timer)
    }
  }, [message, onDismiss])

  if (!message || !isVisible) return null

  return (
    <motion.div
      className="fixed top-4 right-4 z-[9999]"
      style={{
        backgroundColor: '#dc2626',
        color: '#ffffff',
        padding: '12px 16px',
        fontSize: '14px',
        fontWeight: '500',
        maxWidth: '320px',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        fontFamily: 'Courier New, monospace',
      }}
      initial={{ opacity: 0, x: 20, y: -10 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 20, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <p style={{ margin: 0 }}>Error: {message}</p>
    </motion.div>
  )
}
